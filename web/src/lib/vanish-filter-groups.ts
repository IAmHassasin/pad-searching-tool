/** Awakening ids granted on assist vanish (from gamewith-vanish.sqlite). */
import type { AwakeningFilterGroup } from "./awakening-filter-groups";

export const VANISH_FILTER_GROUPS: AwakeningFilterGroup[] = [
  {
    label: "Sub att",
    rows: [
      [91, 92, 93, 94, 95],
    ],
  },
  {
    label: "Add Type",
    rows: [
      [83, 84, 85, 86, 87, 88, 89, 90],
    ],
  },
  {
    label: "Stats",
    rows: [
      [130, 132, 106, 46],
      [127, 131],
    ],
  },
  {
    label: "Match style",
    rows: [
      [117, 119, 120, 96, 121, 122, 123, 125],
      [43, 61, 107],
      [79, 80, 81],
      [44, 108, 110, 126, 109, 115],
    ],
  },
  {
    label: "Resist",
    rows: [
      [52, 28, 136, 68, 69, 70, 54, 55, 53],
    ],
  },
  {
    label: "Enhance orb",
    rows: [
      [137, 99, 100, 101, 102, 103, 104, 29],
    ],
  },
  {
    label: "Others",
    rows: [
      [98],
    ],
  }
];

export function listVanishFilterableAwakeningIds(): number[] {
  const ids: number[] = [];
  for (const group of VANISH_FILTER_GROUPS) {
    for (const row of group.rows) {
      for (const id of row) {
        if (!ids.includes(id)) ids.push(id);
      }
    }
  }
  return ids;
}
