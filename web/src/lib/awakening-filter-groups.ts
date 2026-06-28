/** Curated awakening ids for the filter UI, grouped for quick lookup. */
export type AwakeningFilterGroup = {
  label: string;
  /** Each inner array is one visual row within the group. */
  rows: number[][];
};

export const AWAKENING_FILTER_GROUPS: AwakeningFilterGroup[] = [
  {
    label: "Basic",
    rows: [[49, 21, 56, 51, 97, 105]],
  },
  {
    label: "Sub att",
    rows: [[91, 92, 93, 94, 95]],
  },
  {
    label: "Add Type",
    rows: [[83, 84, 85, 86, 87, 88, 89, 90]],
  },
  {
    label: "Stats",
    rows: [
      [138, 139, 130, 132, 106, 46, 47],
      [128, 129, 127, 142, 143, 131, 141],
      [1, 2, 3, 65, 66, 67],
      [4, 5, 6, 7, 8],
    ],
  },
  {
    label: "Match style",
    rows: [
      [22, 23, 24, 25, 26, 27, 73, 74, 75, 76, 77],
      [116, 117, 118, 119, 120, 96, 121, 122, 123, 124, 125],
      [133, 134, 135],
      [43, 61, 107, 111],
      [59, 60, 78, 50, 79, 80, 81, 82, 48, 57, 58],
      [44, 108, 110, 126, 112, 113, 114, 109, 82],
    ],
  },
  {
    label: "Resist",
    rows: [[52, 28, 136, 68, 69, 70, 141, 54, 55, 140, 71, 72]],
  },
  {
    label: "Killer",
    rows: [[31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42]],
  },
  {
    label: "Enhance orb",
    rows: [[137, 99, 100, 101, 102, 103, 104]],
  },
  {
    label: "Others",
    rows: [[64, 63, 62]],
  },
];

export function listFilterableAwakeningIds(): number[] {
  const ids: number[] = [];
  for (const group of AWAKENING_FILTER_GROUPS) {
    for (const row of group.rows) {
      for (const id of row) {
        if (!ids.includes(id)) ids.push(id);
      }
    }
  }
  return ids;
}
