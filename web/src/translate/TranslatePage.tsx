import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { fetchMonstersByIds } from "../api";
import { AwakeningIconList } from "../components/AwakeningIconList";
import { MonsterDetailCard, type CardStatsMeta } from "../components/MonsterDetailCard";
import { PageHeader } from "../components/PageHeader";
import { CopyCardImageButton } from "../custom-card/CopyCardImageButton";
import {
  imagesFromPasteEvent,
  isClipboardReadSupported,
  readClipboardImages,
} from "../lib/clipboard-images";
import { CustomCardPage } from "../custom-card/CustomCardPage";
import { buildExportFilename, exportElementToPng } from "../custom-card/export-png";
import type { CustomCardDraft } from "../custom-card/types";
import { AWAKENING_DRAFT_MIN_SCORE } from "../lib/translate/awakening-match";
import { fetchCdnArt } from "../lib/translate/cdn-assets";
import { ocrWorkerLoaded } from "../lib/translate/ocr";
import {
  analyzeScreenshot,
  type AnalyzedScreenshot,
  type OcrFields,
  type TranslateStage,
} from "../lib/translate/pipeline";
import { applyStagesToDraft, buildCustomCardDraft, type DraftBuild } from "../lib/translate/to-custom-draft";
import { translateCardTexts, type TranslatedTexts } from "../lib/translate/translate-texts";
import type { MonsterRecord } from "../types";

type ItemStatus =
  | { state: "queued" }
  | { state: "working"; stage: TranslateStage }
  | { state: "failed"; message: string }
  | { state: "known"; analysis: AnalyzedScreenshot; row: MonsterRecord | null }
  | {
      state: "new";
      analysis: AnalyzedScreenshot;
      texts: TranslatedTexts;
      build: DraftBuild;
      /** Set on a stage-popup item whose stages were merged into the detail item of the same card. */
      mergedInto?: number;
    };

type Item = {
  id: number;
  file: File;
  name: string;
  status: ItemStatus;
  /** Set by "not this card": skip the catalog match on the next run. */
  forceNew?: boolean;
};

const STAGE_LABEL: Record<TranslateStage, string> = {
  decode: "Decoding image",
  layout: "Finding the screen layout",
  numbers: "Reading numbers",
  awakenings: "Matching awakenings",
  identify: "Checking the catalog",
  catalog: "Loading catalog data",
  ocr: "Reading Japanese text (OCR)",
  translate: "Translating",
  assets: "Fetching art from the CDN",
  done: "Done",
};

let nextId = 1;

/** The draft with object URLs recreated from its blobs (the editor revokes the URLs it was given on unmount). */
function withFreshObjectUrls(d: CustomCardDraft): CustomCardDraft {
  return {
    ...d,
    sourceArtObjectUrl: d.sourceArtBlob ? URL.createObjectURL(d.sourceArtBlob) : null,
    artObjectUrl: d.artBlob ? URL.createObjectURL(d.artBlob) : null,
    iconObjectUrl: d.iconBlob ? URL.createObjectURL(d.iconBlob) : null,
  };
}

function statsMetaOf(a: AnalyzedScreenshot): CardStatsMeta {
  return {
    level: a.numbers.level.value,
    maxLevel: a.numbers.maxLevel.value,
    plusHp: a.numbers.plusHp.value,
    plusAtk: a.numbers.plusAtk.value,
    plusRcv: a.numbers.plusRcv.value,
    cost: a.numbers.cost.value,
  };
}

async function processFile(
  file: File,
  report: (stage: TranslateStage) => void,
  forceNew = false
): Promise<ItemStatus> {
  const analysis = await analyzeScreenshot(file, report, { forceNew });
  const ident = analysis.identification;
  if (ident.kind === "known" && ident.id != null) {
    report("catalog");
    const { rows } = await fetchMonstersByIds([ident.id]);
    return { state: "known", analysis, row: rows[0] ?? null };
  }
  report("translate");
  const texts = await translateCardTexts(analysis.ocr, analysis.stages);
  texts.notes.push(...analysis.flags);
  report("assets");
  const art = await fetchCdnArt({
    number: analysis.number,
    numberIndexed: analysis.numberIndexed,
    image: analysis.image,
    thumb: analysis.layout.thumb,
  });
  if (art.note) texts.notes.push(art.note);
  const build = await buildCustomCardDraft(analysis, texts, art, file);
  return { state: "new", analysis, texts, build };
}

/**
 * A stage-popup screenshot and the normal detail screenshot of the same card complement each
 * other: the stages go into the detail item's draft, the popup item points at it.
 */
function mergeStages(items: Item[], finishedId: number): Item[] {
  const finished = items.find((it) => it.id === finishedId);
  if (!finished || finished.status.state !== "new" || finished.status.analysis.number == null) return items;
  const number = finished.status.analysis.number;
  const isPopup = finished.status.analysis.screen === "stage-popup";
  const partner = items.find(
    (it) =>
      it.id !== finishedId &&
      it.status.state === "new" &&
      it.status.analysis.number === number &&
      (it.status.analysis.screen === "stage-popup") !== isPopup
  );
  if (!partner || partner.status.state !== "new") return items;
  const popup = isPopup ? finished : partner;
  const detail = isPopup ? partner : finished;
  if (popup.status.state !== "new" || detail.status.state !== "new" || !popup.status.texts.stages) return items;
  const texts: TranslatedTexts = { ...detail.status.texts, stages: popup.status.texts.stages };
  const draft = { ...detail.status.build.draft };
  applyStagesToDraft(draft, texts);
  return items.map((it) => {
    if (it.id === detail.id && it.status.state === "new") {
      return { ...it, status: { ...it.status, texts, build: { ...it.status.build, draft } } };
    }
    if (it.id === popup.id && it.status.state === "new") {
      return { ...it, status: { ...it.status, mergedInto: detail.id } };
    }
    return it;
  });
}

export function TranslatePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<{ itemId: number; draft: CustomCardDraft } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const runningRef = useRef(false);
  /** Latest draft from the embedded editor, kept on "Back" so edits survive re-opening. */
  const editedDraftRef = useRef<CustomCardDraft | null>(null);

  const update = useCallback((id: number, status: ItemStatus, forceNew?: boolean) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, status, forceNew: forceNew ?? it.forceNew } : it))
    );
  }, []);

  const openEditor = useCallback((itemId: number, draft: CustomCardDraft) => {
    editedDraftRef.current = null;
    setEditing({ itemId, draft: withFreshObjectUrls(draft) });
  }, []);

  const closeEditor = useCallback(() => {
    const edited = editedDraftRef.current;
    if (editing && edited) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === editing.itemId && it.status.state === "new"
            ? { ...it, status: { ...it.status, build: { ...it.status.build, draft: edited } } }
            : it
        )
      );
    }
    setEditing(null);
  }, [editing]);

  const onDraftChange = useCallback((draft: CustomCardDraft) => {
    editedDraftRef.current = draft;
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setItems((prev) => [
      ...prev,
      ...list.map((file) => ({ id: nextId++, file, name: file.name, status: { state: "queued" } as ItemStatus })),
    ]);
  }, []);

  // One screenshot at a time: OCR and matching are CPU heavy.
  useEffect(() => {
    if (runningRef.current) return;
    const next = items.find((it) => it.status.state === "queued");
    if (!next) return;
    runningRef.current = true;
    update(next.id, { state: "working", stage: "decode" });
    processFile(next.file, (stage) => update(next.id, { state: "working", stage }), next.forceNew === true)
      .then((status) => {
        setItems((prev) => mergeStages(prev.map((it) => (it.id === next.id ? { ...it, status } : it)), next.id));
      })
      .catch((error: unknown) => {
        update(next.id, { state: "failed", message: error instanceof Error ? error.message : String(error) });
      })
      .finally(() => {
        runningRef.current = false;
        // Re-run the effect for the next queued item.
        setItems((prev) => [...prev]);
      });
  }, [items, update]);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const onPaste = useCallback(
    (e: ClipboardEvent) => {
      const files = imagesFromPasteEvent(e);
      if (files.length) addFiles(files);
    },
    [addFiles]
  );

  // Explicit clipboard read for touch devices, where there is no Ctrl+V.
  const [pasteMessage, setPasteMessage] = useState<string | null>(null);
  const pasteFromClipboard = useCallback(async () => {
    setPasteMessage(null);
    try {
      const files = await readClipboardImages();
      if (!files.length) {
        setPasteMessage("No image in the clipboard. Copy a screenshot first.");
        return;
      }
      addFiles(files);
    } catch (error) {
      setPasteMessage(error instanceof Error ? error.message : "Could not read the clipboard.");
    }
  }, [addFiles]);

  useEffect(() => {
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onPaste]);

  if (editing) {
    return (
      <div className="flex min-h-full flex-col">
        <div className="border-b border-white/[0.08] bg-[var(--color-inset)] px-3 py-1.5 text-xs">
          <button type="button" className="ds-btn pressable min-h-7 px-2" onClick={closeEditor}>
            ← Back to translate results
          </button>
        </div>
        <CustomCardPage
          initialDraft={editing.draft}
          embeddedTitle="Translate · Custom Card"
          onDraftChange={onDraftChange}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-[var(--color-surface)] text-[var(--color-fg)]">
      <PageHeader
        title="Translate"
        subtitle="JP monster detail screenshot → English card"
        maxWidthClass="max-w-6xl"
      >
        <p className="text-[11px] text-[var(--color-muted)]">
          Drop, paste or pick screenshots of the JP client&apos;s monster detail screen. Cards already in the
          catalog are rendered from catalog data; new cards become an editable Custom Card.
          {!ocrWorkerLoaded() && " The first new card downloads the OCR engine (a few MB)."}
        </p>
      </PageHeader>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-3 sm:p-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center text-sm ${
            dragOver ? "border-[var(--color-accent)] bg-[var(--color-inset)]" : "border-white/[0.12]"
          }`}
        >
          <p>Drop screenshots here, paste (Ctrl+V), or</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="ds-btn-primary pressable min-h-9 px-3"
              onClick={() => inputRef.current?.click()}
            >
              Choose images
            </button>
            {isClipboardReadSupported() && (
              <button
                type="button"
                className="ds-btn pressable min-h-9 px-3"
                onClick={() => void pasteFromClipboard()}
                title="Read the image currently in the clipboard (Ctrl+V works too)"
              >
                Paste from clipboard
              </button>
            )}
          </div>
          {pasteMessage && (
            <p className="text-[12px] text-amber-200" role="status">
              {pasteMessage}
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {items.map((item) => (
          <TranslateItem
            key={item.id}
            item={item}
            onEdit={(draft) => openEditor(item.id, draft)}
            onTreatAsNew={() => update(item.id, { state: "queued" }, true)}
          />
        ))}
      </div>
    </div>
  );
}

function TranslateItem({
  item,
  onEdit,
  onTreatAsNew,
}: {
  item: Item;
  onEdit: (draft: CustomCardDraft) => void;
  onTreatAsNew: () => void;
}) {
  const { status } = item;
  return (
    <section className="ds-card p-3">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="ds-label truncate">{item.name}</h2>
        {status.state === "working" && (
          <span className="font-mono text-[11px] text-[var(--color-muted)]" role="status">
            {STAGE_LABEL[status.stage]}…
          </span>
        )}
        {status.state === "queued" && <span className="font-mono text-[11px] text-[var(--color-muted)]">Queued</span>}
      </header>
      {status.state === "failed" && (
        <p className="text-sm text-red-300" role="alert">
          Could not process this screenshot: {status.message}
        </p>
      )}
      {status.state === "known" && <KnownCard analysis={status.analysis} row={status.row} onTreatAsNew={onTreatAsNew} />}
      {status.state === "new" && (
        <NewCard
          analysis={status.analysis}
          texts={status.texts}
          build={status.build}
          mergedInto={status.mergedInto ?? null}
          onEdit={onEdit}
        />
      )}
    </section>
  );
}

function KnownCard({
  analysis,
  row,
  onTreatAsNew,
}: {
  analysis: AnalyzedScreenshot;
  row: MonsterRecord | null;
  onTreatAsNew: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const ident = analysis.identification;
  const download = useCallback(async () => {
    if (!ref.current || !row) return;
    setExporting(true);
    try {
      await exportElementToPng(ref.current, buildExportFilename(row.monster_id ?? null, row.name_en ?? "card"));
    } finally {
      setExporting(false);
    }
  }, [row]);
  return (
    <div className="grid gap-3 lg:grid-cols-[360px_1fr]">
      <div ref={ref} className="w-full max-w-[360px]">
        {row ? (
          <MonsterDetailCard row={row} hideUtilityLinks statsMeta={statsMetaOf(analysis)} />
        ) : (
          <p className="text-sm text-[var(--color-muted)]">Catalog row for No.{ident.id} could not be loaded.</p>
        )}
      </div>
      <div className="space-y-2 text-sm">
        <p>
          Matched catalog card <strong>No.{ident.id}</strong> (icon score {ident.iconScore.toFixed(2)}
          {ident.numberScore != null ? `, header number score ${ident.numberScore.toFixed(2)}` : ""}).
        </p>
        {ident.flags.length > 0 && (
          <ul className="list-disc pl-5 text-[12px] text-amber-200">
            {ident.flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
        <ScreenValues analysis={analysis} />
        <div className="flex flex-wrap gap-2">
          <CopyCardImageButton targetRef={ref} />
          <button type="button" className="ds-btn-primary pressable min-h-9 px-3" onClick={() => void download()} disabled={!row || exporting}>
            {exporting ? "Exporting…" : "Download PNG"}
          </button>
          <button type="button" className="ds-btn pressable min-h-9 px-3" onClick={onTreatAsNew}>
            Not this card? Re-run as a new card
          </button>
        </div>
      </div>
    </div>
  );
}

function ScreenValues({ analysis: a }: { analysis: AnalyzedScreenshot }) {
  const n = a.numbers;
  const fmt = (v: number | null) => (v == null ? "?" : v.toLocaleString());
  const plus = (v: number | null) => (v == null ? "" : ` (+${v})`);
  return (
    <p className="font-mono text-[11px] text-[var(--color-muted)]">
      Screenshot: HP {fmt(n.hp.value)}{plus(n.plusHp.value)} · ATK {fmt(n.atk.value)}{plus(n.plusAtk.value)} · RCV{" "}
      {fmt(n.rcv.value)}{plus(n.plusRcv.value)} · Lv {fmt(n.level.value)}/{fmt(n.maxLevel.value)} · Cost{" "}
      {fmt(n.cost.value)} · CD {fmt(n.turns.value)} · {a.stars}★
    </p>
  );
}

const SOURCE_LABEL = {
  catalog: "from catalog",
  machine: "machine translated",
  unchanged: "not translated",
  failed: "translation failed",
} as const;

function NewCard({
  analysis,
  texts,
  build,
  mergedInto,
  onEdit,
}: {
  analysis: AnalyzedScreenshot;
  texts: TranslatedTexts;
  build: DraftBuild;
  mergedInto: number | null;
  onEdit: (draft: CustomCardDraft) => void;
}) {
  const ident = analysis.identification;
  const popup = analysis.screen === "stage-popup";
  const fields: Array<{ key: keyof OcrFields & keyof TranslatedTexts["sources"]; label: string }> = [
    { key: "name", label: "Name" },
    { key: "activeName", label: "Skill name" },
    { key: "activeDesc", label: "Skill" },
    { key: "leaderName", label: "Leader skill name" },
    { key: "leaderDesc", label: "Leader skill" },
  ];
  // Same cut-off as the generated card; weaker matches are counted, not shown.
  const awakeningIds = analysis.awakenings.flatMap((m) => (m && m.score >= AWAKENING_DRAFT_MIN_SCORE ? [m.id] : []));
  const lowAwakenings = analysis.awakenings.filter((m) => m && m.score < AWAKENING_DRAFT_MIN_SCORE).length;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <img src={analysis.thumbUrl} alt="" className="h-16 w-16 rounded border border-white/[0.12]" />
        <div className="space-y-0.5">
          <p>
            New card <strong>No.{analysis.number ?? "?"}</strong> — not in the catalog
            {ident.candidates[0] ? ` (closest icon: No.${ident.candidates[0].id} at ${ident.candidates[0].score.toFixed(2)})` : ""}.
          </p>
          <p className="text-[11px] text-[var(--color-muted)]">
            Art: {build.artSource === "cdn" ? "CDN portrait" : "cut from the screenshot"} · Icon:{" "}
            {build.iconSource === "cdn" ? "CDN icon" : build.iconSource === "screenshot" ? "cut from the screenshot" : "none (hidden by the popup)"} · Types: {analysis.ocr.types || "?"}
          </p>
          <ScreenValues analysis={analysis} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-muted)]">
        <span>Awakenings{lowAwakenings ? ` (${lowAwakenings} left out, low match score)` : ""}:</span>
        <AwakeningIconList ids={awakeningIds} layout="row" bare />
        {analysis.superAwakening && (
          <>
            <span>· Super:</span>
            <AwakeningIconList ids={[analysis.superAwakening.id]} layout="row" bare />
          </>
        )}
      </div>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="text-left text-[11px] text-[var(--color-muted)]">
            <th className="py-1 pr-2 font-semibold">Field</th>
            <th className="py-1 pr-2 font-semibold">Japanese (OCR)</th>
            <th className="py-1 font-semibold">English</th>
          </tr>
        </thead>
        <tbody>
          {fields.map(({ key, label }) => (
            <tr key={key} className="border-t border-white/[0.06] align-top">
              <td className="py-1.5 pr-2 whitespace-nowrap font-semibold">{label}</td>
              <td className="py-1.5 pr-2" lang="ja">
                {analysis.ocr[key] || <span className="text-[var(--color-muted)]">—</span>}
                <span className="ml-1 font-mono text-[10px] text-[var(--color-muted)]">
                  {Math.round(analysis.ocrConfidence[key])}%
                </span>
              </td>
              <td className="py-1.5">
                {texts[key] || <span className="text-[var(--color-muted)]">—</span>}
                <span
                  className={`ml-1 rounded px-1 font-mono text-[10px] ${
                    texts.sources[key] === "catalog"
                      ? "bg-emerald-900/60 text-emerald-200"
                      : texts.sources[key] === "machine"
                        ? "bg-sky-900/60 text-sky-200"
                        : "bg-white/[0.06] text-[var(--color-muted)]"
                  }`}
                >
                  {SOURCE_LABEL[texts.sources[key]]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {texts.stages && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-[var(--color-muted)]">
            Evolving skill ({texts.stages.kind === "evo-loop" ? "loops back to stage 1" : "evolves once per use"}):
          </p>
          <table className="w-full border-collapse text-[12px]">
            <tbody>
              {texts.stages.stages.map((stage, i) => (
                <tr key={i} className="border-t border-white/[0.06] align-top">
                  <td className="py-1.5 pr-2 whitespace-nowrap font-semibold">
                    {stage.final ? "Final" : `Stage ${i + 1}`}
                    {stage.turns != null ? ` · CD ${stage.turns}` : ""}
                  </td>
                  <td className="py-1.5 pr-2" lang="ja">
                    <div>{analysis.stages?.stages[i]?.name ?? "(from the stage popup screenshot)"}</div>
                    <div className="text-[var(--color-muted)]">{analysis.stages?.stages[i]?.body}</div>
                  </td>
                  <td className="py-1.5">
                    <div>{stage.name}</div>
                    <div className="text-[var(--color-muted)]">{stage.body}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mergedInto != null && (
        <p className="rounded bg-emerald-900/40 px-2 py-1 text-[12px] text-emerald-200">
          Stages merged into the detail screenshot of the same card (No.{analysis.number}); open that one to edit
          and export.
        </p>
      )}
      {popup && mergedInto == null && (
        <p className="rounded bg-amber-900/40 px-2 py-1 text-[12px] text-amber-200">
          Add the normal detail screenshot of No.{analysis.number ?? "?"} to fill in stats, level, cost and the
          icon; the stages will be merged into it automatically.
        </p>
      )}
      {texts.notes.length > 0 && (
        <ul className="list-disc pl-5 text-[12px] text-amber-200">
          {texts.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-[var(--color-muted)]">
        Every value above is editable in the Custom Card editor; check the English against the Japanese before
        exporting.
      </p>
      <button type="button" className="ds-btn-primary pressable min-h-9 px-3" onClick={() => onEdit(build.draft)}>
        Open in Custom Card editor
      </button>
    </div>
  );
}
