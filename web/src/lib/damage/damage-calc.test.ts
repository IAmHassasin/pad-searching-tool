import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attributeAdvantage,
  capDamage,
  computeCardDamage,
  computeMatchDamage,
  DAMAGE_CAP,
  DAMAGE_CAP_EXPANDED,
  orbCountFactor,
  type CardDamageInput,
  type DamageMatchInput,
} from "./damage-calc.ts";

function near(actual: number, expected: number, msg?: string) {
  assert.ok(
    Math.abs(actual - expected) < 1e-6 * Math.max(1, Math.abs(expected)),
    msg ?? `expected ${expected}, got ${actual}`
  );
}

const fire3: DamageMatchInput = { attribute: 0, orbs: 3 };

function input(
  overrides: Partial<CardDamageInput["card"]> = {},
  matches: DamageMatchInput[] = [fire3],
  board: Partial<CardDamageInput["board"]> = {},
  enemy: CardDamageInput["enemy"] = {}
): CardDamageInput {
  return {
    card: { atk: 1000, mainAttribute: 0, awakenings: [], ...overrides },
    board: { matches, ...board },
    enemy,
  };
}

describe("capDamage", () => {
  it("truncates at 2^31 − 1 and at twice that when expanded", () => {
    assert.equal(DAMAGE_CAP, 2_147_483_647);
    assert.equal(DAMAGE_CAP_EXPANDED, 4_294_967_294);
    assert.equal(capDamage(5), 5);
    assert.equal(capDamage(DAMAGE_CAP + 1), DAMAGE_CAP);
    assert.equal(capDamage(DAMAGE_CAP + 1, true), DAMAGE_CAP + 1);
    assert.equal(capDamage(DAMAGE_CAP_EXPANDED + 10, true), DAMAGE_CAP_EXPANDED);
  });
});

describe("orbCountFactor", () => {
  it("adds 25% per orb past three", () => {
    assert.equal(orbCountFactor(3), 1);
    assert.equal(orbCountFactor(4), 1.25);
    assert.equal(orbCountFactor(6), 1.75);
    assert.equal(orbCountFactor(2), 1);
  });
});

describe("attributeAdvantage", () => {
  it("follows the colour wheel and light/dark mutual weakness", () => {
    assert.equal(attributeAdvantage(0, 2), 2);
    assert.equal(attributeAdvantage(2, 0), 0.5);
    assert.equal(attributeAdvantage(1, 0), 2);
    assert.equal(attributeAdvantage(0, 1), 0.5);
    assert.equal(attributeAdvantage(3, 4), 2);
    assert.equal(attributeAdvantage(4, 3), 2);
    assert.equal(attributeAdvantage(3, 3), 1);
    assert.equal(attributeAdvantage(0, 3), 1);
    assert.equal(attributeAdvantage(0, null), 1);
  });
});

describe("computeMatchDamage", () => {
  it("ignores matches of other attributes", () => {
    assert.equal(computeMatchDamage({ attribute: 1, orbs: 3 }, input()), 0);
  });

  it("applies TPA only on exactly four orbs", () => {
    const tpa = input({ awakenings: [27, 27] });
    near(computeMatchDamage({ attribute: 0, orbs: 4 }, tpa), 1000 * 1.25 * 2.2 * 2.2);
    near(computeMatchDamage({ attribute: 0, orbs: 5 }, tpa), 1000 * 1.5);
    near(computeMatchDamage({ attribute: 0, orbs: 3 }, tpa), 1000);
  });

  it("stacks shape awakenings per count on the card", () => {
    const vdp = input({ awakenings: [48, 109] });
    near(
      computeMatchDamage({ attribute: 0, orbs: 9, shape: "vdp" }, vdp),
      1000 * orbCountFactor(9) * 3.5 * 12.25
    );
    const l = input({ awakenings: [60] });
    near(computeMatchDamage({ attribute: 0, orbs: 5, shape: "l" }, l), 1000 * 1.5 * 2.2);
    near(computeMatchDamage({ attribute: 0, orbs: 5, shape: "cross" }, l), 1000 * 1.5);
    const t = input({ awakenings: [126, 78] });
    near(computeMatchDamage({ attribute: 0, orbs: 5, shape: "t" }, t), 1000 * 1.5 * 8);
    near(computeMatchDamage({ attribute: 0, orbs: 5, shape: "cross" }, t), 1000 * 1.5 * 3);
  });

  it("applies enhanced orbs with the team orb-enhance count", () => {
    const i = input({ awakenings: [14] }, [fire3], { teamAwakenings: [14, 14, 99] });
    near(
      computeMatchDamage({ attribute: 0, orbs: 3, enhancedOrbs: 2 }, i),
      1000 * (1 + 0.06 * 2) * (1 + 0.07 * 2 + 0.14)
    );
  });

  it("uses the sub-attribute factor", () => {
    near(
      computeMatchDamage({ attribute: 1, orbs: 3 }, input({ subAttribute: 1, slot: "sub" })),
      1000 / 3
    );
    near(
      computeMatchDamage({ attribute: 0, orbs: 3 }, input({ subAttribute: 0, slot: "sub" })),
      100
    );
  });
});

describe("computeCardDamage", () => {
  it("sums matches and applies the combo count factor", () => {
    const r = computeCardDamage(input({}, [fire3, { attribute: 0, orbs: 4 }, { attribute: 1, orbs: 3 }]));
    assert.deepEqual(r.perMatch, [1000, 1250, 0]);
    near(r.subtotal, 2250 * (1 + 0.25 * 2));
    assert.equal(r.capped, false);
    assert.equal(r.fixedBonusDamage, 0);
  });

  it("applies row enhance per team awakening and per row", () => {
    const r = computeCardDamage(
      input({}, [{ attribute: 0, orbs: 6, isRow: true }, { attribute: 0, orbs: 6, isRow: true }], {
        teamAwakenings: [22, 22, 116],
      })
    );
    near(r.subtotal, 2 * 1000 * 1.75 * (1 + (0.9 * 2 + 0.9) * 2) * 1.25);
  });

  it("applies attribute combo enhance only with two or more matches", () => {
    const one = computeCardDamage(input({}, [fire3], { teamAwakenings: [73] }));
    near(one.subtotal, 1000);
    const three = computeCardDamage(
      input({}, [fire3, fire3, fire3], { teamAwakenings: [73, 121] })
    );
    near(three.subtotal, 3000 * (1 + (0.3 + 0.6) * 2) * 1.5);
  });

  it("applies combo boost thresholds", () => {
    const c = (combos: number, awk: number[]) =>
      computeCardDamage(input({ awakenings: awk }, [fire3], { combos })).subtotal /
      (1000 * (1 + 0.25 * (combos - 1)));
    near(c(6, [43]), 1);
    near(c(7, [43]), 2);
    near(c(14, [43]), 3);
    near(c(7, [107]), 4);
    near(c(14, [107]), 9);
    near(c(9, [61]), 1);
    near(c(10, [61, 111]), 125);
    near(c(14, [144]), 1);
    near(c(15, [144]), 100);
  });

  it("applies colour boosts, HP side, blessings and blob", () => {
    const board: DamageMatchInput[] = [
      fire3,
      { attribute: 1, orbs: 3 },
      { attribute: 2, orbs: 3 },
      { attribute: 6, orbs: 3 },
    ];
    const r = computeCardDamage(
      input({ awakenings: [79, 80, 57, 71], hpRatio: 0.6 }, board)
    );
    // 79 (3 colours ×3.5), 57 (HP ≥ 50% ×10), 71 (jammer ×10); 80 needs 4 colours.
    near(r.subtotal, 1000 * 3.5 * 10 * 10 * (1 + 0.25 * 3));
    const low = computeCardDamage(input({ awakenings: [57, 58], hpRatio: 0.3 }));
    near(low.subtotal, 10_000);
    const blob = computeCardDamage(input({ awakenings: [82] }, [{ attribute: 0, orbs: 12 }]));
    near(blob.subtotal, 1000 * orbCountFactor(12) * 12);
  });

  it("applies leader multiplier and caps the sub-total", () => {
    const r = computeCardDamage(input({ atk: 1e9 }, [fire3], { leaderMultiplier: 16 }));
    assert.equal(r.subtotalCapped, DAMAGE_CAP);
    assert.equal(r.capped, true);
    const e = computeCardDamage(input({ atk: 1e9 }, [fire3], { leaderMultiplier: 3 }), );
    assert.equal(e.subtotalCapped, DAMAGE_CAP);
    const expanded = computeCardDamage(
      input({ atk: 1e9 }, [fire3], { leaderMultiplier: 3 }, { expandedCap: true })
    );
    assert.equal(expanded.subtotalCapped, 3e9);
    assert.equal(expanded.expandedCap, true);
  });

  it("applies killers, latents, attribute advantage, DEF floor and passives", () => {
    const r = computeCardDamage(
      input({ awakenings: [32, 32, 31], matchedKillerLatents: 1 }, [fire3], {}, {
        types: [5],
        attribute: 2,
        defense: 500,
        passiveMultiplier: 0.5,
      })
    );
    near(r.afterKiller, 1000 * 25 * 2);
    near(r.afterAttribute, 1000 * 50 * 2);
    near(r.afterDefense, 100_000 - 500);
    near(r.actual, (100_000 - 500) * 0.5);
    const floor = computeCardDamage(input({ atk: 10 }, [fire3], {}, { defense: 1_000_000 }));
    assert.equal(floor.afterDefense, 1);
    assert.equal(floor.actual, 1);
  });

  it("ignores DEF with Guard Break on five colours", () => {
    const five: DamageMatchInput[] = [0, 1, 2, 3, 4].map((a) => ({ attribute: a, orbs: 3 }));
    const r = computeCardDamage(input({ awakenings: [44] }, five, {}, { defense: 999_999 }));
    near(r.subtotal, 1000 * 3 * 2);
    near(r.afterDefense, r.afterAttribute);
  });

  it("reports fixed bonus damage for heal rows and heal squares", () => {
    const r = computeCardDamage(
      input({ awakenings: [45, 50] }, [
        fire3,
        { attribute: 5, orbs: 6, isRow: true },
        { attribute: 5, orbs: 9, shape: "vdp" },
      ])
    );
    assert.equal(r.fixedBonusDamage, 10_500_000);
    near(r.subtotal, 1000 * 8 * 1.5);
  });
});
