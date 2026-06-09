/** Parse dadguide `awakenings` column, e.g. `(52),(56)| (56),(111)`. */
export function parseAwakeningIds(raw?: string | null): number[] {
  if (!raw?.trim()) return [];
  return [...raw.matchAll(/\((\d+)\)/g)].map((m) => Number(m[1]));
}

export function parseAwakenings(raw?: string | null): {
  regular: number[];
  super: number[];
} {
  if (!raw?.trim()) return { regular: [], super: [] };
  const [regularPart = "", superPart = ""] = raw.split("|");
  return {
    regular: parseAwakeningIds(regularPart),
    super: parseAwakeningIds(superPart),
  };
}
