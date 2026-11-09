import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { attachTransformTargets, rowMonsterId } from "./transform-targets.ts";

describe("attachTransformTargets", () => {
  it("adds sorted, de-duplicated targets per monster and [] for the rest", () => {
    const rows = [{ monster_id: 13412 }, { __source_pk: "8614" }, { monster_id: 1 }];
    const out = attachTransformTargets(rows, [
      { from_monster_id: 8614, to_monster_id: 8620 },
      { from_monster_id: 8614, to_monster_id: 8618 },
      { from_monster_id: 8614, to_monster_id: 8620 },
      { from_monster_id: 13412, to_monster_id: 13413 },
      { from_monster_id: 99999, to_monster_id: 1 },
    ]);
    assert.deepEqual(out[0].transform_to_ids, [13413]);
    assert.deepEqual(out[1].transform_to_ids, [8618, 8620]);
    assert.deepEqual(out[2].transform_to_ids, []);
    assert.deepEqual(out[0].transform_from_ids, []);
    assert.deepEqual(out[2].transform_from_ids, [99999], "post-transform form links back");
    assert.equal((out[0] as { monster_id: number }).monster_id, 13412, "other fields kept");
  });

  it("adds the first form of the chain as transform_root_id", () => {
    // Rosetta: 12437 → 12438 → 12439 (PDC writes 12437 for all three); 13483 has no link.
    const edges = [
      { from_monster_id: 12437, to_monster_id: 12438 },
      { from_monster_id: 12438, to_monster_id: 12439 },
    ];
    const out = attachTransformTargets(
      [{ monster_id: 12439 }, { monster_id: 12438 }, { monster_id: 12437 }, { monster_id: 13483 }],
      edges
    );
    assert.deepEqual(
      out.map((r) => r.transform_root_id),
      [12437, 12437, 12437, null]
    );
    assert.deepEqual(out[0].transform_from_ids, [12438], "direct link only");
  });

  it("stops on a cycle", () => {
    const out = attachTransformTargets(
      [{ monster_id: 2 }],
      [
        { from_monster_id: 1, to_monster_id: 2 },
        { from_monster_id: 2, to_monster_id: 1 },
      ]
    );
    assert.equal(out[0].transform_root_id, 1);
  });

  it("reads the id from monster_id or __source_pk", () => {
    assert.equal(rowMonsterId({ monster_id: "12" }), 12);
    assert.equal(rowMonsterId({ __source_pk: 7 }), 7);
    assert.equal(rowMonsterId({ name_en: "x" }), null);
  });
});
