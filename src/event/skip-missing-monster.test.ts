import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NotFoundException } from "@nestjs/common";
import {
  fallbackMonsterFamily,
  loadFamilyOrNull,
} from "./skip-missing-monster.ts";

describe("loadFamilyOrNull", () => {
  it("returns null when the monster is missing instead of throwing", async () => {
    const family = await loadFamilyOrNull(async (id) => {
      throw new NotFoundException(`Monster ${id} not found.`);
    }, 13923);
    assert.equal(family, null);
  });

  it("returns the family when the monster exists", async () => {
    const family = await loadFamilyOrNull(async (id) => ({ id }), 100);
    assert.deepEqual(family, { id: 100 });
  });
});

describe("fallbackMonsterFamily", () => {
  it("keeps a showcase card when the monster is not in SQLite", () => {
    const family = fallbackMonsterFamily(13923);
    assert.equal(family.monsterId, 13923);
    assert.equal(family.coverMonsterId, 13923);
    assert.equal(family.nodes[0]?.monster_id, 13923);
  });
});
