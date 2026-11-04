import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMPTY_MONSTER_FILTERS, EMPTY_SKILL_FILTERS } from "../../types.ts";
import {
  appendIdToList,
  hasAnyQuickSearchFilter,
  quickSearchQueryKey,
  replaceIdValue,
} from "./quick-search-helpers.ts";

describe("quick search helpers", () => {
  it("does not search until some filter is set", () => {
    assert.equal(
      hasAnyQuickSearchFilter(EMPTY_MONSTER_FILTERS, EMPTY_SKILL_FILTERS),
      false
    );
    assert.equal(
      hasAnyQuickSearchFilter(
        { ...EMPTY_MONSTER_FILTERS, idQuery: " 12806 " },
        EMPTY_SKILL_FILTERS
      ),
      true
    );
    assert.equal(
      hasAnyQuickSearchFilter(
        { ...EMPTY_MONSTER_FILTERS, awakeningIds: [27] },
        EMPTY_SKILL_FILTERS
      ),
      true
    );
    assert.equal(
      hasAnyQuickSearchFilter(EMPTY_MONSTER_FILTERS, {
        ...EMPTY_SKILL_FILTERS,
        activeCdMax: 5,
      }),
      true
    );
    assert.equal(
      hasAnyQuickSearchFilter(EMPTY_MONSTER_FILTERS, {
        ...EMPTY_SKILL_FILTERS,
        selectedPatterns: [
          { skillType: "active_skill", tagKey: "t", label: "Heal" },
        ],
      }),
      true
    );
  });

  it("builds the same query key regardless of Set insertion order", () => {
    const a = { ...EMPTY_MONSTER_FILTERS, rarity: new Set([7, 5]) };
    const b = { ...EMPTY_MONSTER_FILTERS, rarity: new Set([5, 7]) };
    assert.equal(
      quickSearchQueryKey(a, EMPTY_SKILL_FILTERS),
      quickSearchQueryKey(b, EMPTY_SKILL_FILTERS)
    );
    assert.notEqual(
      quickSearchQueryKey(a, EMPTY_SKILL_FILTERS),
      quickSearchQueryKey(EMPTY_MONSTER_FILTERS, EMPTY_SKILL_FILTERS)
    );
  });

  it("fills single-id fields and appends to list fields", () => {
    assert.equal(replaceIdValue("123", 12806), "12806");
    assert.equal(appendIdToList("", 1), "1");
    assert.equal(appendIdToList("11735", 13605), "11735, 13605");
    assert.equal(appendIdToList("11735, ", 13605), "11735, 13605");
    assert.equal(appendIdToList("11735 13605", 13605), "11735 13605");
  });
});
