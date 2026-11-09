import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deleteSavedTeam,
  loadSavedTeams,
  MAX_SAVED_TEAMS,
  SAVED_TEAMS_STORAGE_KEY,
  findSavedTeamByName,
  saveTeam,
} from "./saved-teams-storage.ts";
import type { StorageLike } from "./team-draft-storage.ts";
import { defaultTeamBuildConfig, type TeamBuildConfig } from "./types.ts";

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

function teamWith(leaderId: string): TeamBuildConfig {
  const c = defaultTeamBuildConfig();
  c.members[0] = { ...c.members[0], monsterId: leaderId };
  return c;
}

const at = (iso: string) => new Date(iso);

describe("saved teams storage", () => {
  it("saves, lists newest first and loads a config snapshot", () => {
    const s = memoryStorage();
    assert.equal(saveTeam("Alpha", teamWith("100"), s, at("2026-11-09T10:00:00Z")).ok, true);
    assert.equal(saveTeam("Beta", teamWith("200"), s, at("2026-11-09T11:00:00Z")).ok, true);
    const teams = loadSavedTeams(s);
    assert.deepEqual(teams.map((t) => t.name), ["Beta", "Alpha"]);
    assert.equal(teams[1].config.members[0].monsterId, "100");
  });

  it("replaces a team saved under the same name (case-insensitive)", () => {
    const s = memoryStorage();
    const first = saveTeam("Alpha", teamWith("100"), s, at("2026-11-09T10:00:00Z"));
    const second = saveTeam("  alpha ", teamWith("300"), s, at("2026-11-09T12:00:00Z"));
    assert.ok(first.ok && second.ok);
    assert.equal(second.replaced, true);
    assert.equal(second.team.id, first.team.id);
    const teams = loadSavedTeams(s);
    assert.equal(teams.length, 1);
    assert.equal(teams[0].config.members[0].monsterId, "300");
  });

  it("matches names by letter case only", () => {
    const s = memoryStorage();
    saveTeam("たま", teamWith("1"), s);
    saveTeam("Rá", teamWith("1"), s);
    const teams = loadSavedTeams(s);
    assert.equal(findSavedTeamByName(teams, "タマ"), null, "hiragana ≠ katakana");
    assert.equal(findSavedTeamByName(teams, "Ra"), null, "accents stay distinct");
    assert.equal(findSavedTeamByName(teams, " rá ")?.name, "Rá");
    assert.equal(findSavedTeamByName(teams, ""), null);
  });

  it("keeps the snapshot independent of later edits to the draft", () => {
    const s = memoryStorage();
    const draft = teamWith("100");
    saveTeam("Alpha", draft, s);
    draft.members[0].monsterId = "999";
    assert.equal(loadSavedTeams(s)[0].config.members[0].monsterId, "100");
  });

  it("deletes one team and leaves the others", () => {
    const s = memoryStorage();
    const a = saveTeam("Alpha", teamWith("100"), s, at("2026-11-09T10:00:00Z"));
    saveTeam("Beta", teamWith("200"), s, at("2026-11-09T11:00:00Z"));
    assert.ok(a.ok);
    const res = deleteSavedTeam(a.team.id, s);
    assert.equal(res.ok, true);
    assert.deepEqual(loadSavedTeams(s).map((t) => t.name), ["Beta"]);
    assert.equal(deleteSavedTeam("missing", s).ok, false);
  });

  it("rejects an empty name and a full list", () => {
    const s = memoryStorage();
    assert.deepEqual(saveTeam("   ", teamWith("1"), s).ok, false);
    for (let i = 0; i < MAX_SAVED_TEAMS; i += 1) saveTeam(`T${i}`, teamWith("1"), s);
    const res = saveTeam("One more", teamWith("1"), s);
    assert.equal(res.ok, false);
    assert.equal(!res.ok && res.error, "limit");
    // Overwriting an existing name still works at the limit.
    assert.equal(saveTeam("T0", teamWith("2"), s).ok, true);
  });

  it("reports a storage failure instead of pretending to save", () => {
    const s = memoryStorage();
    s.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    const res = saveTeam("Alpha", teamWith("1"), s);
    assert.equal(res.ok, false);
    assert.equal(!res.ok && res.error, "storage");
  });

  it("ignores corrupt entries and corrupt JSON", () => {
    const s = memoryStorage();
    s.setItem(
      SAVED_TEAMS_STORAGE_KEY,
      JSON.stringify([{ id: "a", name: "Ok", savedAt: "2026-11-09T00:00:00Z", config: {} }, { id: 5 }, null, "x"])
    );
    const teams = loadSavedTeams(s);
    assert.equal(teams.length, 1);
    assert.equal(teams[0].config.members.length, 6, "config sanitized to the default shape");
    s.setItem(SAVED_TEAMS_STORAGE_KEY, "{not json");
    assert.deepEqual(loadSavedTeams(s), []);
  });
});
