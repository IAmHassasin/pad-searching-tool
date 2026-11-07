import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMPTY_MONSTER_FILTERS, type MonsterFilters } from "../types.ts";
import { countMonsterChipFilters, hasActiveMonsterFilters } from "./filters.ts";

function withFilters(partial: Partial<MonsterFilters>): MonsterFilters {
  return { ...EMPTY_MONSTER_FILTERS, ...partial };
}

describe("hasActiveMonsterFilters", () => {
  it("is false for the empty filter set", () => {
    assert.equal(hasActiveMonsterFilters(EMPTY_MONSTER_FILTERS), false);
  });

  it("treats a whitespace-only id query as inactive", () => {
    assert.equal(hasActiveMonsterFilters(withFilters({ idQuery: "   " })), false);
    assert.equal(hasActiveMonsterFilters(withFilters({ idQuery: "10432" })), true);
  });

  it("no longer knows any stats-range fields", () => {
    assert.equal("hpMin" in EMPTY_MONSTER_FILTERS, false);
    assert.equal("rcvMax" in EMPTY_MONSTER_FILTERS, false);
  });
});

describe("countMonsterChipFilters", () => {
  it("counts rarity, attribute and type as one each (not per value)", () => {
    assert.equal(countMonsterChipFilters(EMPTY_MONSTER_FILTERS), 0);
    assert.equal(
      countMonsterChipFilters(withFilters({ rarity: new Set([7, 8]) })),
      1
    );
    assert.equal(
      countMonsterChipFilters(
        withFilters({
          rarity: new Set([7]),
          attributeSlots: [new Set([0]), new Set(), new Set([4])],
          types: new Set([2, 4]),
        })
      ),
      3
    );
  });

  it("ignores the id query and awakening stacks (they have their own controls)", () => {
    assert.equal(
      countMonsterChipFilters(
        withFilters({ idQuery: "Flame", awakeningIds: [1, 2], vanishOnly: true })
      ),
      0
    );
  });
});
