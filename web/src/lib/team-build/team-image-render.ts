import { awakeningSpriteImageUrl, getAwakeningSpriteCoords } from "../awakening-sprite";
import { iconUrl } from "../portraits";
import type { TeamImageCard, TeamImageLayout } from "./team-image-layout";

/** Output pixels per layout pixel; icons are 100px so 2× keeps text crisp without upscaling art much. */
const RENDER_SCALE = 2;
const FONT_FAMILY = '"Arial Black", "Segoe UI", Arial, sans-serif';
const CORNER_RADIUS = 10;
const SA_ICON_PX = 26;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
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

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + size, y, x + size, y + size, r);
  ctx.arcTo(x + size, y + size, x, y + size, r);
  ctx.arcTo(x, y + size, x, y, r);
  ctx.arcTo(x, y, x + size, y, r);
  ctx.closePath();
}

function outlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontPx: number,
  fill: string,
  align: CanvasTextAlign = "left"
) {
  ctx.font = `900 ${fontPx}px ${FONT_FAMILY}`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2.5, fontPx * 0.2);
  ctx.strokeStyle = "#000000";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function drawIcon(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  monsterId: number,
  x: number,
  y: number,
  size: number
) {
  if (img) {
    ctx.drawImage(img, x, y, size, size);
  } else {
    roundedRect(ctx, x, y, size, CORNER_RADIUS);
    ctx.fillStyle = "#1f2430";
    ctx.fill();
    outlinedText(ctx, `#${monsterId}`, x + size / 2, y + size / 2 + 6, 16, "#e5e7eb", "center");
  }
  // Card number, bottom-right like Tsubaki.
  outlinedText(ctx, String(monsterId), x + size - 5, y + size - 4, 10, "#ffffff", "right");
}

function drawEmptySlot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  roundedRect(ctx, x + 4, y + 4, size - 8, CORNER_RADIUS);
  ctx.fillStyle = "rgba(15, 18, 26, 0.85)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.stroke();
}

function drawSuperAwakening(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLImageElement | null,
  awokenSkillId: number,
  x: number,
  y: number
) {
  const coords = sprite ? getAwakeningSpriteCoords(awokenSkillId) : null;
  if (!sprite || !coords) return;
  ctx.drawImage(sprite, -coords.x, -coords.y, coords.tileWidth, coords.tileHeight, x, y, SA_ICON_PX, SA_ICON_PX);
}

function drawCardLabels(ctx: CanvasRenderingContext2D, card: TeamImageCard, size: number) {
  const { x, y, plus } = card;
  if (plus.kind === "total") {
    outlinedText(ctx, plus.text, x + 4, y + 24, 22, "#fde047");
  } else if (plus.kind === "perStat") {
    plus.lines.forEach((line, i) => outlinedText(ctx, line, x + 4, y + 15 + i * 14, 12, "#fde047"));
  }
  if (card.level != null) {
    outlinedText(ctx, `Lv.${card.level}`, x + 5, y + size - 13, 15, "#ffffff");
  }
}

/** Draw the layout onto a new canvas (transparent background, like Tsubaki). */
export async function renderTeamImageCanvas(layout: TeamImageLayout): Promise<HTMLCanvasElement> {
  const size = layout.iconPx;
  const ids = new Set<number>();
  let needsSprite = false;
  for (const slot of layout.slots) {
    if (slot.card) ids.add(slot.card.monsterId);
    if (slot.assist) ids.add(slot.assist.monsterId);
    if (slot.card?.superAwakeningId != null) needsSprite = true;
  }

  const [sprite, ...icons] = await Promise.all([
    needsSprite ? loadImage(awakeningSpriteImageUrl) : Promise.resolve(null),
    ...[...ids].map((id) => loadImage(iconUrl(id)).then((img) => [id, img] as const)),
  ]);
  const iconById = new Map(icons as Array<readonly [number, HTMLImageElement | null]>);

  const canvas = document.createElement("canvas");
  canvas.width = layout.width * RENDER_SCALE;
  canvas.height = layout.height * RENDER_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser");
  ctx.scale(RENDER_SCALE, RENDER_SCALE);
  ctx.imageSmoothingQuality = "high";

  for (const slot of layout.slots) {
    if (slot.assist) {
      const { monsterId, x, y } = slot.assist;
      drawIcon(ctx, iconById.get(monsterId) ?? null, monsterId, x, y, size);
    }
    if (!slot.card) {
      drawEmptySlot(ctx, slot.x, layout.cardRowY, size);
      continue;
    }
    const card = slot.card;
    drawIcon(ctx, iconById.get(card.monsterId) ?? null, card.monsterId, card.x, card.y, size);
    if (card.superAwakeningId != null) {
      drawSuperAwakening(ctx, sprite as HTMLImageElement | null, card.superAwakeningId, card.x + size - SA_ICON_PX - 3, card.y + 3);
    }
    drawCardLabels(ctx, card, size);
  }
  return canvas;
}

export async function renderTeamImageBlob(layout: TeamImageLayout): Promise<Blob> {
  const canvas = await renderTeamImageCanvas(layout);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the team image"))), "image/png");
  });
}
