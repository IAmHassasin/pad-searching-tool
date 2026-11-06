/**
 * Screenshot → ranked monster-id candidates per slot. Pure: works on an RGBA buffer and a parsed
 * icon index, so the same code runs in the browser and in `scripts/match-team-screenshot.ts`.
 *
 * Steps: find candidate frame rows by their edges → coarse-rank every slot of each row against
 * the index and keep the row whose five big cards score best → align each icon box by
 * correlation with its own top candidates (a few px / % of scale matter) → final ranking.
 *
 * The five big cards are compared on `TEAM_CARD_CELLS` only, so the attribute orb and the
 * awakening badges the game paints over them do not count; the small helper icon and the assist
 * inlays carry no such badges and use every cell.
 */
import {
  ALL_CELLS,
  cardDescriptor,
  grayThumbnail,
  maskedCorrelation,
  TEAM_CARD_CELLS,
  type Box,
  type CellMask,
  type RgbaImage,
} from "./descriptor.ts";
import {
  descriptorForId,
  rankIconCandidates,
  type IconCandidate,
  type IconIndex,
} from "./icon-index.ts";
import {
  assistBoxFor,
  boxesForRow,
  candidateRows,
  EDIT_TEAM_LAYOUT,
  HELPER_SLOT,
  toGrayImage,
  type LayoutProfile,
} from "./layout.ts";

/** The best card candidate is preselected from this score on … */
export const PRESELECT_MIN_SCORE = 0.75;
/** … and flagged for a second look below this one (same art on several ids, weak crops). */
export const PRESELECT_SURE_SCORE = 0.9;
/** Assist inlays are small and partly covered; weaker suggestions are hidden. */
export const ASSIST_MIN_SCORE = 0.72;
export const CARD_CANDIDATES = 5;
export const ASSIST_CANDIDATES = 3;

/** Candidates the alignment step tries to line up with. */
const ALIGN_CANDIDATES = 8;
const ALIGN_RADIUS_CARD = 5;
const ALIGN_RADIUS_SMALL = 4;
/** Size deltas (px) tried while aligning; ±4 % of a 150 px icon. */
const ALIGN_SCALES = [-6, -3, 0, 3, 6];

export type SlotMatch = {
  slotIndex: number;
  box: Box;
  candidates: IconCandidate[];
  assistBox: Box | null;
  assistCandidates: IconCandidate[];
};

export type ScreenshotMatch = {
  profileId: string;
  rowY: number;
  /** Mean best score of the five big cards — how sure the row detection is. */
  score: number;
  slots: SlotMatch[];
};

function rankBox(
  img: RgbaImage,
  index: IconIndex,
  box: Box,
  topN: number,
  cells: CellMask
): IconCandidate[] {
  return rankIconCandidates(index, cardDescriptor(grayThumbnail(img, box)), topN, cells);
}

function cellsForSlot(slotIndex: number): CellMask {
  return slotIndex === HELPER_SLOT ? ALL_CELLS : TEAM_CARD_CELLS;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * `ranked` plus the `known` ids scored against `descriptor`, sorted, trimmed to `topN`.
 * Lets a card that ranks poorly on its own still list an id confirmed elsewhere on the screen.
 */
export function withKnownCandidates(
  index: IconIndex,
  descriptor: Uint8Array,
  ranked: IconCandidate[],
  known: Iterable<number>,
  cells: CellMask,
  topN: number
): IconCandidate[] {
  const merged = [...ranked];
  for (const id of known) {
    if (merged.some((c) => c.id === id)) continue;
    const target = descriptorForId(index, id);
    if (!target) continue;
    merged.push({ id, score: maskedCorrelation(descriptor, target, cells) });
  }
  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, topN);
}

/**
 * Shift and scale `box` a little to maximise its correlation (over `cells`) with any of
 * `candidates`. Returns the box unchanged when nothing beats the starting point.
 */
export function alignBoxToCandidates(
  img: RgbaImage,
  index: IconIndex,
  box: Box,
  candidates: IconCandidate[],
  radius: number,
  cells: CellMask = ALL_CELLS
): Box {
  const targets = candidates
    .map((c) => descriptorForId(index, c.id))
    .filter((d): d is Uint8Array => d !== null);
  if (targets.length === 0) return box;
  const scoreOf = (b: Box): number => {
    const desc = cardDescriptor(grayThumbnail(img, b));
    let best = -1;
    for (const t of targets) {
      const c = maskedCorrelation(desc, t, cells);
      if (c > best) best = c;
    }
    return best;
  };
  let best = box;
  let bestScore = scoreOf(box);
  for (const ds of ALIGN_SCALES) {
    const w = box.w + ds;
    if (w < 8) continue;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (ds === 0 && dx === 0 && dy === 0) continue;
        const candidate = { x: box.x + dx, y: box.y + dy, w, h: w };
        const score = scoreOf(candidate);
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
    }
  }
  return best;
}

export function matchScreenshot(
  img: RgbaImage,
  index: IconIndex,
  profile: LayoutProfile = EDIT_TEAM_LAYOUT
): ScreenshotMatch | null {
  const gray = toGrayImage(img);
  let best: { rowY: number; score: number; boxes: Box[]; coarse: IconCandidate[][] } | null =
    null;
  for (const rowY of candidateRows(gray, profile)) {
    const { cards } = boxesForRow(profile, img.width, rowY);
    const coarse = cards.map((box, i) =>
      rankBox(img, index, box, ALIGN_CANDIDATES, cellsForSlot(i))
    );
    let sum = 0;
    for (let i = 0; i < cards.length; i++) {
      if (i !== HELPER_SLOT) sum += coarse[i][0]?.score ?? 0;
    }
    const score = sum / Math.max(1, cards.length - 1);
    if (!best || score > best.score) best = { rowY, score, boxes: cards, coarse };
  }
  if (!best) return null;

  // Per-slot alignment, trusted only where it lands on a strong candidate.
  const aligned = best.boxes.map((initial, slotIndex) => {
    const radius = slotIndex === HELPER_SLOT ? ALIGN_RADIUS_SMALL : ALIGN_RADIUS_CARD;
    const cells = cellsForSlot(slotIndex);
    const box = alignBoxToCandidates(
      img,
      index,
      initial,
      best.coarse[slotIndex],
      radius,
      cells
    );
    const candidates = rankBox(img, index, box, CARD_CANDIDATES, cells);
    return { initial, box, candidates };
  });
  const isStrong = (c: IconCandidate[]) => (c[0]?.score ?? 0) >= PRESELECT_MIN_SCORE;
  // A weak card (nothing strong to align to) would drift towards whatever it was compared
  // with; the five cards share one row geometry, so it takes the shift of the strong ones.
  const strongCards = aligned.filter((s, i) => i !== HELPER_SLOT && isStrong(s.candidates));
  const shared = {
    dx: median(strongCards.map((s) => s.box.x - s.initial.x)),
    dy: median(strongCards.map((s) => s.box.y - s.initial.y)),
    dw: median(strongCards.map((s) => s.box.w - s.initial.w)),
  };
  for (let i = 0; i < aligned.length; i++) {
    const slot = aligned[i];
    if (i === HELPER_SLOT || isStrong(slot.candidates)) continue;
    const box = {
      x: slot.initial.x + shared.dx,
      y: slot.initial.y + shared.dy,
      w: slot.initial.w + shared.dw,
      h: slot.initial.w + shared.dw,
    };
    slot.box = box;
    slot.candidates = rankBox(img, index, box, CARD_CANDIDATES, cellsForSlot(i));
  }
  // Ids seen confidently on the cards (duplicate subs, helper = own leader) are tried on every
  // slot: an icon whose stored art differs from the in-game card still ranks.
  const known = new Set<number>();
  for (const s of aligned) if (isStrong(s.candidates)) known.add(s.candidates[0].id);
  // A weak helper has no sibling geometry to borrow; align it to the known ids instead.
  const helper = aligned[HELPER_SLOT];
  if (helper && !isStrong(helper.candidates) && known.size > 0) {
    const targets = [...known].map((id) => ({ id, score: 0 }));
    helper.box = alignBoxToCandidates(
      img,
      index,
      helper.initial,
      targets,
      ALIGN_RADIUS_SMALL,
      cellsForSlot(HELPER_SLOT)
    );
    helper.candidates = rankBox(img, index, helper.box, CARD_CANDIDATES, cellsForSlot(HELPER_SLOT));
  }

  const slots: SlotMatch[] = aligned.map(({ box, candidates: ranked }, slotIndex) => {
    const cells = cellsForSlot(slotIndex);
    const candidates = withKnownCandidates(
      index,
      cardDescriptor(grayThumbnail(img, box)),
      ranked,
      known,
      cells,
      CARD_CANDIDATES
    );
    let assistBox: Box | null = null;
    let assistCandidates: IconCandidate[] = [];
    if (slotIndex !== HELPER_SLOT) {
      const initialAssist = assistBoxFor(box, profile);
      const coarseAssist = rankBox(img, index, initialAssist, ALIGN_CANDIDATES, ALL_CELLS);
      assistBox = alignBoxToCandidates(
        img,
        index,
        initialAssist,
        coarseAssist,
        ALIGN_RADIUS_SMALL
      );
      assistCandidates = rankBox(img, index, assistBox, ASSIST_CANDIDATES, ALL_CELLS);
    }
    return { slotIndex, box, candidates, assistBox, assistCandidates };
  });

  let sum = 0;
  for (const s of slots) if (s.slotIndex !== HELPER_SLOT) sum += s.candidates[0]?.score ?? 0;
  return {
    profileId: profile.id,
    rowY: best.rowY,
    score: sum / Math.max(1, slots.length - 1),
    slots,
  };
}

/** The candidate the UI ticks by default, or null when the user must choose. */
export function preselectedCandidate(
  candidates: IconCandidate[]
): IconCandidate | null {
  const first = candidates[0];
  return first && first.score >= PRESELECT_MIN_SCORE ? first : null;
}

/** True when a preselected candidate should be highlighted for the user to double-check. */
export function needsReview(candidate: IconCandidate): boolean {
  return candidate.score < PRESELECT_SURE_SCORE;
}

/** Assist candidates worth showing (never preselected). */
export function assistSuggestions(candidates: IconCandidate[]): IconCandidate[] {
  return candidates.filter((c) => c.score >= ASSIST_MIN_SCORE);
}
