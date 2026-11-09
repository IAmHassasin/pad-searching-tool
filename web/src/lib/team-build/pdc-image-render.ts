import { awakeningSpriteImageUrl, getAwakeningSpriteCoords } from "../awakening-sprite";
import { iconUrl } from "../portraits";
import { pdcQrModules, type PdcImageCard, type PdcImageModel } from "./pdc-image";

/** Output width matches PDC's own export (1080 px on the phones we have samples from). */
const WIDTH = 1080;
const MARGIN = 12;
/** QR module size; 4 modules of quiet zone come from MARGIN. */
const QR_MODULE_PX = 3;
const COL_W = WIDTH / 6;
const ICON = 170;
const ARROW_H = 50;
const ROW_GAP = 8;
const BADGE_W = 92;
const BADGE_H = 62;
const AWK_PX = 50;
const LABEL_H = 30;

const FONT = '"Segoe UI", "Hiragino Sans", "Noto Sans JP", Arial, sans-serif';
const PLUS_FONT = '"Arial Black", "Segoe UI", Arial, sans-serif';
const COLORS = {
  background: "#ffffff",
  band: "#fde4e4",
  text: "#555555",
  arrow: "#ef4444",
  footer: "#3b78b7",
  plus: "#fde047",
  levelHigh: "#7cff3a",
  superFrame: "#2f80ed",
  syncFrame: "#d9467a",
  empty: "#1f2430",
};

const FOOTER_TEXT = "PDC team QR · made with PAD Searching Tool";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // The icon CDN sends `Access-Control-Allow-Origin: *`; without this the canvas is tainted.
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function outlined(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, fill: string) {
  ctx.font = `900 ${px}px ${PLUS_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, px * 0.18);
  ctx.strokeStyle = "#000000";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** Greedy wrap that keeps words together when there are spaces and splits CJK by character. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const token of paragraph.split(/(\s+)/)) {
      if (!token) continue;
      if (ctx.measureText(line + token).width <= maxWidth) {
        line += token;
        continue;
      }
      if (line.trim()) lines.push(line.trimEnd());
      line = "";
      for (const ch of token.trimStart()) {
        if (ctx.measureText(line + ch).width > maxWidth && line) {
          lines.push(line);
          line = "";
        }
        line += ch;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

function drawQr(ctx: CanvasRenderingContext2D, modules: boolean[][], x: number, y: number) {
  ctx.fillStyle = "#000000";
  modules.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) ctx.fillRect(x + c * QR_MODULE_PX, y + r * QR_MODULE_PX, QR_MODULE_PX, QR_MODULE_PX);
    }),
  );
}

function drawBadge(ctx: CanvasRenderingContext2D, label: string, x: number, y: number) {
  const gradient = ctx.createLinearGradient(0, y, 0, y + BADGE_H);
  gradient.addColorStop(0, "#8fbf3a");
  gradient.addColorStop(1, "#4d7a12");
  roundRect(ctx, x, y, BADGE_W, BADGE_H, 10);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#d8cfa6";
  ctx.stroke();
  ctx.font = `900 ${label.length > 5 ? 17 : 22}px ${PLUS_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#1f3300";
  ctx.strokeText(label, x + BADGE_W / 2, y + BADGE_H / 2 + 1);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, x + BADGE_W / 2, y + BADGE_H / 2 + 1);
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  card: PdcImageCard,
  icon: HTMLImageElement | null,
  sprite: HTMLImageElement | null,
  x: number,
  y: number,
) {
  if (icon) {
    ctx.drawImage(icon, x, y, ICON, ICON);
  } else {
    roundRect(ctx, x, y, ICON, ICON, 12);
    ctx.fillStyle = COLORS.empty;
    ctx.fill();
  }
  if (card.plusLabel) outlined(ctx, card.plusLabel, x + 6, y + 44, 38, COLORS.plus);

  if (card.awakening && sprite) {
    const coords = getAwakeningSpriteCoords(card.awakening.id);
    if (coords) {
      const ax = x + ICON - AWK_PX - 6;
      const ay = y + ICON - LABEL_H - AWK_PX - 6;
      roundRect(ctx, ax - 3, ay - 3, AWK_PX + 6, AWK_PX + 6, 6);
      ctx.fillStyle = card.awakening.kind === "super" ? COLORS.superFrame : COLORS.syncFrame;
      ctx.fill();
      ctx.drawImage(sprite, -coords.x, -coords.y, coords.tileWidth, coords.tileHeight, ax, ay, AWK_PX, AWK_PX);
    }
  }

  // Bottom strip: "LV99|No13509" (level in green from Lv 110, like PDC).
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(x, y + ICON - LABEL_H, ICON, LABEL_H);
  ctx.font = `700 21px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const ty = y + ICON - LABEL_H / 2 + 1;
  let tx = x + 6;
  if (card.level != null) {
    const lv = `LV${card.level}`;
    ctx.fillStyle = card.level >= 110 ? COLORS.levelHigh : "#ffffff";
    ctx.fillText(lv, tx, ty);
    tx += ctx.measureText(lv).width;
    ctx.fillStyle = "#ffffff";
    ctx.fillText("|", tx, ty);
    tx += ctx.measureText("|").width;
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`No${card.monsterId}`, tx, ty);
}

function drawArrow(ctx: CanvasRenderingContext2D, cx: number, y: number) {
  ctx.fillStyle = COLORS.arrow;
  ctx.beginPath();
  ctx.moveTo(cx - 62, y + 10);
  ctx.lineTo(cx - 34, y + 10);
  ctx.lineTo(cx - 48, y + 38);
  ctx.closePath();
  ctx.fill();
  ctx.font = `800 28px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Assist", cx - 26, y + ARROW_H / 2);
}

/** Draws the PDC-style team image on a new canvas. */
export async function renderPdcImageCanvas(model: PdcImageModel): Promise<HTMLCanvasElement> {
  const modules = pdcQrModules(model.qrText);
  const ids = new Set<number>();
  let needsSprite = false;
  for (const s of model.slots) {
    if (s.card) ids.add(s.card.monsterId);
    if (s.assist) ids.add(s.assist.monsterId);
    if (s.card?.awakening) needsSprite = true;
  }
  const [sprite, ...icons] = await Promise.all([
    needsSprite ? loadImage(awakeningSpriteImageUrl) : Promise.resolve(null),
    ...[...ids].map((id) => loadImage(iconUrl(id)).then((img) => [id, img] as const)),
  ]);
  const iconById = new Map(icons as Array<readonly [number, HTMLImageElement | null]>);

  // Measure the memo first: it decides the canvas height.
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) throw new Error("Canvas is not supported in this browser");
  probe.font = `400 36px ${FONT}`;
  const memoLines = model.memo ? wrapLines(probe, model.memo, WIDTH - 2 * 24) : [];

  const qrSize = modules.length * QR_MODULE_PX;
  const titleY = MARGIN + qrSize + 20;
  const gridY = titleY + BADGE_H + 18;
  const cardY = gridY + ICON + ARROW_H;
  const gridBottom = cardY + ICON + ROW_GAP;
  const footerY = gridBottom + 40;
  const memoY = footerY + 54;
  const height = (memoLines.length ? memoY + (memoLines.length - 1) * 46 + 24 : footerY + 14) + MARGIN;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser");
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WIDTH, height);

  drawQr(ctx, modules, MARGIN, MARGIN);

  let titleX = MARGIN;
  if (model.badgeLabel) {
    drawBadge(ctx, model.badgeLabel, MARGIN, titleY);
    titleX += BADGE_W + 14;
  }
  if (model.title) {
    ctx.font = `700 44px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.text;
    ctx.fillText(fitText(ctx, model.title, WIDTH - titleX - MARGIN), titleX, titleY + BADGE_H / 2 + 2);
  }

  ctx.fillStyle = COLORS.band;
  ctx.fillRect(0, gridY - ROW_GAP, WIDTH, gridBottom - gridY + ROW_GAP);
  model.slots.forEach((slot, i) => {
    const x = i * COL_W + (COL_W - ICON) / 2;
    if (slot.assist) {
      drawCard(ctx, slot.assist, iconById.get(slot.assist.monsterId) ?? null, null, x, gridY);
      drawArrow(ctx, i * COL_W + COL_W / 2, gridY + ICON);
    }
    if (slot.card) {
      drawCard(ctx, slot.card, iconById.get(slot.card.monsterId) ?? null, sprite as HTMLImageElement | null, x, cardY);
    }
  });

  ctx.font = `700 26px ${FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.footer;
  ctx.fillText(FOOTER_TEXT, WIDTH - MARGIN - 4, footerY);

  ctx.font = `400 36px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.text;
  memoLines.forEach((line, i) => ctx.fillText(line, 24, memoY + i * 46));

  return canvas;
}

export async function renderPdcImageBlob(model: PdcImageModel): Promise<Blob> {
  const canvas = await renderPdcImageCanvas(model);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the PDC image"))), "image/png");
  });
}
