import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAssistResonanceSearchUrl,
  buildSearchParamsFromFilters,
  parseMonsterFiltersFromSearch,
} from "./monster-search-url.ts";
import { EMPTY_MONSTER_FILTERS, EMPTY_SKILL_FILTERS } from "../types.ts";

function filtersFromUrl(url: string) {
  const search = url.slice(url.indexOf("?"));
  return parseMonsterFiltersFromSearch(search, EMPTY_MONSTER_FILTERS);
}

describe("assist resonance search", () => {
  it("keeps Fire (attribute id 0) on the attribute filter", () => {
    const url = buildAssistResonanceSearchUrl({
      attribute_1_id: 0,
      type_1_id: 2,
      type_2_id: 4,
      type_3_id: null,
    });
    assert.ok(url);
    const filters = filtersFromUrl(url);
    assert.equal(filters.attributeSlots[0].has(0), true);
    assert.equal(filters.attributeMatch, "all");
    assert.equal(filters.awakeningIds.includes(49), true);
    assert.equal(filters.types.has(2), true);
    assert.equal(filters.types.has(4), true);
  });

  it("keeps a non-zero primary attribute", () => {
    const url = buildAssistResonanceSearchUrl({
      attribute_1_id: 1,
      type_1_id: 5,
      type_2_id: null,
      type_3_id: null,
    });
    assert.ok(url);
    assert.equal(filtersFromUrl(url).attributeSlots[0].has(1), true);
  });

  it("keeps type id 0 and still drops awakening id 0", () => {
    const filters = parseMonsterFiltersFromSearch(
      "?types=0,5&awakeningIds=0,49&attributeSlot2=0",
      EMPTY_MONSTER_FILTERS
    );
    assert.equal(filters.types.has(0), true);
    assert.equal(filters.types.has(5), true);
    assert.deepEqual(filters.awakeningIds, [49]);
    assert.equal(filters.attributeSlots[1].has(0), true);
  });
});

describe("stats range removal", () => {
  it("ignores legacy hpMin/atkMax/rcvMin params on old share links", () => {
    const filters = parseMonsterFiltersFromSearch(
      "?hpMin=1000&atkMax=2500&rcvMin=10&rarity=7",
      EMPTY_MONSTER_FILTERS
    );
    assert.equal(filters.rarity.has(7), true);
    assert.equal("hpMin" in filters, false);
    assert.equal("atkMax" in filters, false);
    assert.equal("rcvMin" in filters, false);
  });

  it("never emits stats params on share links", () => {
    const q = buildSearchParamsFromFilters(
      { ...EMPTY_MONSTER_FILTERS, idQuery: " 10432 " },
      EMPTY_SKILL_FILTERS
    );
    for (const key of ["hpMin", "hpMax", "atkMin", "atkMax", "rcvMin", "rcvMax"]) {
      assert.equal(q.has(key), false, key);
    }
    assert.equal(q.get("idQuery"), "10432");
  });

  it("round-trips the id / name query", () => {
    const q = buildSearchParamsFromFilters(
      { ...EMPTY_MONSTER_FILTERS, idQuery: "Flame" },
      EMPTY_SKILL_FILTERS
    );
    const filters = parseMonsterFiltersFromSearch(`?${q}`, EMPTY_MONSTER_FILTERS);
    assert.equal(filters.idQuery, "Flame");
  });
});
