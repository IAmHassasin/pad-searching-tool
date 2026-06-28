import type { GimmickChip } from "./types";

export function gimmickMap(chips: GimmickChip[]) {
  return new Map(chips.map((g) => [g.id, g]));
}

export function stripPadTitle(titleJa: string) {
  return titleJa.replace(/^【パズドラ】/, "").trim();
}

function parseNum(raw: string): number {
  return parseFloat(raw.replace(/,/g, ""));
}

/** Format 万 (man) values: 1万 = 10K, 100万 = 1M, 2100万 = 21M */
function formatMan(n: number): string {
  if (n >= 100) {
    const m = n / 100;
    return m % 1 === 0
      ? `${m.toLocaleString("en-US")}M`
      : `${m.toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
  }
  if (n >= 10) return `${(n * 10).toLocaleString("en-US")}K`;
  return `${n.toLocaleString("en-US")}0K`;
}

/** 1億 = 100M (Japanese oku = 10^8). */
export function okuToM(n: number): string {
  return `${(n * 100).toLocaleString("en-US")}M`;
}

/** HP/DEF stat field: `3000億` → `300,000M`, `10億` → `1,000M`. */
export function formatPadStatM(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const s = value.trim();
  const oku = s.match(/^([\d,]+(?:\.\d+)?)\s*億$/);
  if (oku) return okuToM(parseNum(oku[1]));
  const man = s.match(/^([\d,]+(?:\.\d+)?)\s*万$/);
  if (man) return formatMan(parseNum(man[1]));
  return convertJapaneseUnitsInText(s);
}

/** Replace embedded 億/万 in effect text. */
export function convertJapaneseUnitsInText(text: string): string {
  let out = text;
  out = out.replace(
    /HP\s*:?\s*([\d,]+(?:\.\d+)?)\s*億/gi,
    (_, n) => `HP: ${okuToM(parseNum(n))}`
  );
  out = out.replace(
    /(?:DEF|防御)\s*:?\s*([\d,]+(?:\.\d+)?)\s*億/gi,
    (_, n) => `DEF: ${okuToM(parseNum(n))}`
  );
  out = out.replace(
    /([\d,]+(?:\.\d+)?)\s*億以上/g,
    (_, n) => `${okuToM(parseNum(n))} or more`
  );
  out = out.replace(/([\d,]+(?:\.\d+)?)\s*億/g, (_, n) =>
    okuToM(parseNum(n))
  );
  out = out.replace(/([\d,]+(?:\.\d+)?)\s*万/g, (_, n) =>
    formatMan(parseNum(n))
  );
  return out;
}
