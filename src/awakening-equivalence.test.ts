import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  AWAKENING_EQUIVALENCE_RULES,
  relatedAwakeningIdsForFilter,
  requiredAwakeningCounts,
} from "./awakening-equivalence.ts";

const SB = 21;
const SB_PLUS = 56;

describe("requiredAwakeningCounts", () => {
  test("SB+ and SB together require 3 SB-equivalents", () => {
    assert.deepEqual([...requiredAwakeningCounts([SB_PLUS, SB])], [[SB, 3]]);
  });

  test("single SB+ requires 2 SB-equivalents (unchanged behavior)", () => {
    assert.deepEqual([...requiredAwakeningCounts([SB_PLUS])], [[SB, 2]]);
  });

  test("repeated base ids accumulate", () => {
    assert.deepEqual([...requiredAwakeningCounts([SB, SB])], [[SB, 2]]);
  });

  test("ids without equivalence keep their own count", () => {
    assert.deepEqual(
      [...requiredAwakeningCounts([1, 1, SB])],
      [
        [1, 2],
        [SB, 1],
      ]
    );
  });

  test("separate families stay separate", () => {
    // 52 = 2 x 10 (Bind), 116 = 3 x 22 (Fire rows)
    assert.deepEqual(
      [...requiredAwakeningCounts([52, 116, 10, 22])],
      [
        [10, 3],
        [22, 4],
      ]
    );
  });

  for (const { composite, base, basePerComposite: k } of AWAKENING_EQUIVALENCE_RULES) {
    describe(`${composite} = ${k} x ${base}`, () => {
      test("composite + base adds up", () => {
        assert.deepEqual(
          [...requiredAwakeningCounts([composite, base])],
          [[base, k + 1]]
        );
      });

      test("two composites + two bases add up", () => {
        assert.deepEqual(
          [...requiredAwakeningCounts([base, composite, base, composite])],
          [[base, 2 * k + 2]]
        );
      });

      test("composite alone needs k bases", () => {
        assert.deepEqual([...requiredAwakeningCounts([composite])], [[base, k]]);
      });

      test("filter evaluates both ids", () => {
        assert.deepEqual(
          relatedAwakeningIdsForFilter(base).sort((a, b) => a - b),
          [base, composite].sort((a, b) => a - b)
        );
        assert.deepEqual(
          relatedAwakeningIdsForFilter(composite).sort((a, b) => a - b),
          [base, composite].sort((a, b) => a - b)
        );
      });
    });
  }
});

describe("AWAKENING_EQUIVALENCE_RULES integrity", () => {
  test("each composite and base appears in exactly one rule", () => {
    const composites = AWAKENING_EQUIVALENCE_RULES.map((r) => r.composite);
    const bases = AWAKENING_EQUIVALENCE_RULES.map((r) => r.base);
    assert.equal(new Set(composites).size, composites.length);
    assert.equal(new Set(bases).size, bases.length);
  });

  test("no id is both a base and a composite (no chains)", () => {
    const bases = new Set(AWAKENING_EQUIVALENCE_RULES.map((r) => r.base));
    for (const { composite } of AWAKENING_EQUIVALENCE_RULES) {
      assert.equal(bases.has(composite), false, `id ${composite}`);
    }
  });

  test("multipliers are 2 or 3", () => {
    for (const r of AWAKENING_EQUIVALENCE_RULES) {
      assert.ok([2, 3].includes(r.basePerComposite), `id ${r.composite}`);
    }
  });

  test("double-effect '+' awakenings are covered", () => {
    const expected: Array<[number, number]> = [
      [56, 21], [52, 10], [53, 19], [98, 9], [99, 14], [100, 15],
      [101, 16], [102, 17], [103, 18], [104, 29], [115, 20],
    ];
    for (const [composite, base] of expected) {
      const rule = AWAKENING_EQUIVALENCE_RULES.find((r) => r.composite === composite);
      assert.deepEqual(rule, { composite, base, basePerComposite: 2 });
    }
  });
});
