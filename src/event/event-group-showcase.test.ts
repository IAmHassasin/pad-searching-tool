import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGroupShowcase } from "./event-group-showcase.ts";

describe("buildGroupShowcase", () => {
  it("shows every group member and badges only the new cards", () => {
    const cards = buildGroupShowcase(
      [
        { monsterId: 10, familyIds: [10, 11] },
        { monsterId: 20, familyIds: [20] },
        { monsterId: 30, familyIds: [30] },
      ],
      [
        {
          monsterId: 11,
          role: "new-evolution",
          label: "New Evolution",
        },
        { monsterId: 20, role: "new-monster", label: "New Monster" },
      ]
    );

    assert.deepEqual(
      cards.map((c) => ({
        monsterId: c.monsterId,
        label: c.label,
        isNew: c.isNew,
      })),
      [
        { monsterId: 10, label: "New Evolution", isNew: true },
        { monsterId: 20, label: "New Monster", isNew: true },
        { monsterId: 30, label: null, isNew: false },
      ]
    );
  });

  it("keeps group order among returning cards after the new ones", () => {
    const cards = buildGroupShowcase(
      [
        { monsterId: 1, familyIds: [1] },
        { monsterId: 2, familyIds: [2] },
        { monsterId: 3, familyIds: [3] },
      ],
      [{ monsterId: 3, role: "new-monster", label: "New Monster" }]
    );
    assert.deepEqual(
      cards.map((c) => c.monsterId),
      [3, 1, 2]
    );
  });
});
