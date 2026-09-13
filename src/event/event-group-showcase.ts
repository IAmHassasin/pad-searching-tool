export type ShowcaseMark = {
  monsterId: number;
  role: "new-monster" | "new-evolution" | "returning";
  label?: string | null;
  note?: string | null;
};

export type ShowcaseMember = {
  monsterId: number;
  familyIds: number[];
};

export type ShowcaseCard = ShowcaseMember & {
  role: ShowcaseMark["role"];
  label: string | null;
  note: string | null;
  isNew: boolean;
};

/** Full collab group, with New Monster / New Evolution badges on source cards. */
export function buildGroupShowcase(
  members: ShowcaseMember[],
  marks: ShowcaseMark[]
): ShowcaseCard[] {
  const decorated = members.map((member) => {
    const ids = new Set(member.familyIds);
    const mark = marks.find((m) => ids.has(m.monsterId));
    if (!mark) {
      return {
        ...member,
        role: "returning" as const,
        label: null,
        note: null,
        isNew: false,
      };
    }
    return {
      ...member,
      role: mark.role,
      label: mark.label ?? null,
      note: mark.note ?? null,
      isNew: mark.role !== "returning",
    };
  });

  return [
    ...decorated.filter((c) => c.isNew),
    ...decorated.filter((c) => !c.isNew),
  ];
}

export function familyIdsFromNodes(
  monsterId: number,
  coverMonsterId: number,
  baseId: number,
  nodes: Array<{ monster_id?: unknown }>
): number[] {
  const ids = new Set<number>([monsterId, coverMonsterId, baseId]);
  for (const node of nodes) {
    const id = Number(node.monster_id);
    if (Number.isFinite(id) && id > 0) ids.add(id);
  }
  return [...ids];
}
