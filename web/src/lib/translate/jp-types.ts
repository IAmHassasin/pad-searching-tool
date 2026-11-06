/** Japanese monster type labels shown on the detail screen → dadguide type ids. */
export const JP_TYPE_LABELS: ReadonlyArray<{ label: string; id: number }> = [
  { label: "バランス", id: 1 },
  { label: "体力", id: 2 },
  { label: "回復", id: 3 },
  { label: "ドラゴン", id: 4 },
  { label: "神", id: 5 },
  { label: "攻撃", id: 6 },
  { label: "悪魔", id: 7 },
  { label: "マシン", id: 8 },
  { label: "進化用", id: 0 },
  { label: "覚醒用", id: 12 },
  { label: "強化合成用", id: 14 },
  { label: "売却用", id: 15 },
];

/**
 * Type ids named in an OCR'd type row, in reading order. Longer labels are matched first so
 * "強化合成用" is not split into "強化" + "合成用"; "神" alone is only accepted when it is not
 * part of another label.
 */
export function parseJpTypeLabels(text: string): number[] {
  const found: { index: number; id: number }[] = [];
  // OCR reads the kanji 力 (power) as the katakana カ now and then.
  let rest = text.replace(/\s+/g, "").replace(/体カ/g, "体力");
  const ordered = [...JP_TYPE_LABELS].sort((a, b) => b.label.length - a.label.length);
  for (const { label, id } of ordered) {
    let from = 0;
    for (;;) {
      const index = rest.indexOf(label, from);
      if (index < 0) break;
      found.push({ index, id });
      rest = rest.slice(0, index) + "\u0000".repeat(label.length) + rest.slice(index + label.length);
      from = index + label.length;
    }
  }
  found.sort((a, b) => a.index - b.index);
  const ids: number[] = [];
  for (const { id } of found) if (!ids.includes(id)) ids.push(id);
  return ids.slice(0, 3);
}
