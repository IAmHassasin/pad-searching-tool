import { NotFoundException } from "@nestjs/common";

export async function loadFamilyOrNull<T>(
  getFamily: (monsterId: number) => Promise<T>,
  monsterId: number
): Promise<T | null> {
  try {
    return await getFamily(monsterId);
  } catch (err) {
    if (err instanceof NotFoundException) return null;
    throw err;
  }
}

/** Seed IDs still render as cards when the working SQLite is behind CDN art. */
export function fallbackMonsterFamily(monsterId: number): {
  monsterId: number;
  baseId: number;
  coverMonsterId: number;
  nodes: Record<string, unknown>[];
  edges: { from: number; to: number; kind: "evolution" | "transform" }[];
} {
  return {
    monsterId,
    baseId: monsterId,
    coverMonsterId: monsterId,
    nodes: [{ monster_id: monsterId }],
    edges: [],
  };
}
