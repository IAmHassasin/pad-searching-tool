import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareNaIdTiebreak,
  compareNewestCatalog,
  filterRowsByIdScope,
  listedMonsterId,
} from "./result-id-scope.ts";
import type { MonsterRecord } from "../types.ts";

function card(partial: MonsterRecord): MonsterRecord {
  return partial;
}

describe("compareNewestCatalog", () => {
  it("lists JP-only cards first by JP ID, then NA cards by NA ID", () => {
    const rows = [
      card({ monster_id: 100, monster_no_na: 90, name_en: "old-na" }),
      card({ monster_id: 500, monster_no_na: null, name_en: "mid-jp" }),
      card({ monster_id: 800, monster_no_na: 400, name_en: "new-na" }),
      card({ monster_id: 900, monster_no_na: null, name_en: "new-jp" }),
    ];
    const sorted = [...rows].sort(compareNewestCatalog);
    assert.deepEqual(
      sorted.map((row) => row.name_en),
      ["new-jp", "mid-jp", "new-na", "old-na"]
    );
  });
});

describe("compareNaIdTiebreak", () => {
  it("keeps a card with an NA ID ahead of a JP-only card", () => {
    const na = card({ monster_id: 100, monster_no_na: 50 });
    const jpOnly = card({ monster_id: 900, monster_no_na: null });
    assert.ok(compareNaIdTiebreak(jpOnly, na) > 0);
    assert.ok(compareNaIdTiebreak(na, jpOnly) < 0);
  });

  it("orders two JP-only cards by JP ID descending", () => {
    const older = card({ monster_id: 400, monster_no_na: null });
    const newer = card({ monster_id: 900, monster_no_na: null });
    assert.ok(compareNaIdTiebreak(newer, older) < 0);
  });
});

describe("filterRowsByIdScope", () => {
  it("hides cards without an NA ID when scope is na", () => {
    const rows = [
      card({ monster_id: 1, monster_no_na: 1 }),
      card({ monster_id: 2, monster_no_na: null }),
    ];
    assert.equal(filterRowsByIdScope(rows, "all").length, 2);
    assert.deepEqual(
      filterRowsByIdScope(rows, "na").map((row) => row.monster_id),
      [1]
    );
  });
});

describe("listedMonsterId", () => {
  it("shows the JP id when the card has no NA id", () => {
    assert.deepEqual(listedMonsterId({ monster_id: 12345, monster_no_na: null }), {
      text: "JP#12345",
      region: "jp",
      value: 12345,
    });
    assert.equal(listedMonsterId({ monster_id: 10, monster_no_na: 9 }).text, "#9");
    assert.equal(listedMonsterId({}).text, "—");
  });
});
