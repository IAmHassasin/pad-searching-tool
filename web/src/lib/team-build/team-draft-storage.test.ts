import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearDraftMembers,
  draftHasCards,
  loadTeamDraft,
  sanitizeTeamBuildConfig,
  saveTeamDraft,
  setDraftSlot,
  TEAM_DRAFT_STORAGE_KEY,
  type StorageLike,
} from "./team-draft-storage.ts";
import { defaultTeamBuildConfig } from "./types.ts";

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

describe("team draft storage", () => {
  it("round-trips a config through storage", () => {
    const storage = memoryStorage();
    const config = defaultTeamBuildConfig();
    const withCards = setDraftSlot(
      setDraftSlot(config, 0, "monster", 12806),
      0,
      "assist",
      13022
    );
    assert.equal(saveTeamDraft(withCards, storage), true);
    assert.ok(storage.data.has(TEAM_DRAFT_STORAGE_KEY));
    const loaded = loadTeamDraft(storage);
    assert.ok(loaded);
    assert.equal(loaded.members[0].monsterId, "12806");
    assert.equal(loaded.members[0].eqId, "13022");
    assert.equal(loaded.members[1].monsterId, "");
  });

  it("returns null when nothing is stored or the JSON is broken", () => {
    const storage = memoryStorage();
    assert.equal(loadTeamDraft(storage), null);
    storage.setItem(TEAM_DRAFT_STORAGE_KEY, "{not json");
    assert.equal(loadTeamDraft(storage), null);
    assert.equal(loadTeamDraft(null), null);
  });

  it("sanitizes unknown values back to defaults", () => {
    const cfg = sanitizeTeamBuildConfig({
      members: [{ monsterId: "abc", plusHp: 999, level: 150 }],
      badge: "not-a-badge",
      awkSettings: { enabled: [128, "x", 128, -1], yinYang: 5 },
      leaderOverrides: [{ hp: "2" }],
      dungeonId: "bad id!",
      customDungeon: { hp: "0.5", sun: "yes" },
    });
    assert.equal(cfg.members.length, 6);
    assert.equal(cfg.members[0].monsterId, "");
    assert.equal(cfg.members[0].plusHp, 297);
    assert.equal(cfg.members[0].level, 120);
    assert.equal(cfg.members[0].role, "leader");
    assert.equal(cfg.members[5].role, "leader");
    assert.equal(cfg.badge, "none");
    assert.deepEqual(cfg.awkSettings.enabled, [128]);
    assert.equal(cfg.awkSettings.yinYang, null);
    assert.deepEqual(cfg.leaderOverrides[0], { hp: 2, rcv: 1 });
    assert.equal(cfg.dungeonId, "none");
    assert.equal(cfg.customDungeon.hp, 0.5);
    assert.equal(cfg.customDungeon.sun, false);
  });

  it("sets and clears slots without touching other members", () => {
    let cfg = defaultTeamBuildConfig();
    cfg = setDraftSlot(cfg, 2, "monster", 5);
    cfg = setDraftSlot(cfg, 2, "assist", 6);
    assert.equal(cfg.members[2].monsterId, "5");
    assert.equal(cfg.members[2].eqId, "6");
    assert.equal(draftHasCards(cfg), true);

    const cleared = setDraftSlot(cfg, 2, "monster", null);
    assert.equal(cleared.members[2].monsterId, "");
    assert.equal(cleared.members[2].eqId, "6");

    assert.equal(setDraftSlot(cfg, 9, "monster", 1), cfg);
    assert.equal(draftHasCards(clearDraftMembers(cfg)), false);
    assert.equal(draftHasCards(defaultTeamBuildConfig()), false);
  });
});
