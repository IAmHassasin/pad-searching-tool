import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import type { EffectValueFamiliesFile } from "../patterns/effect-value-types.ts";
import {
  effectClauseTurns,
  effectMatch,
  registerSqliteRegexp,
} from "../patterns/register-sqlite-regexp.ts";
import {
  cooldownSql,
  parseSkillTextTerms,
  skillGlobMatch,
  skillTextTermsSql,
} from "../patterns/skill-search-sql.ts";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const dbPath = path.join(root, "seed/dadguide.sqlite");

function memoryDb(): Database.Database {
  const db = new Database(":memory:");
  registerSqliteRegexp(db);
  db.exec("CREATE TABLE s (id INTEGER, txt TEXT, cd INTEGER)");
  const insert = db.prepare("INSERT INTO s VALUES (?, ?, ?)");
  insert.run(1, "Delay enemies' next attack by 1 turn; Unlock all orbs", 5);
  insert.run(2, "Charge all allies' skills by 12 turns", 8);
  insert.run(3, "For 2 turns, reduce damage taken by 50%", 8);
  insert.run(4, "Reduce damage taken by 50%; Delay by 3 turns", 12);
  return db;
}

function ids(db: Database.Database, where: string, params: unknown[]): number[] {
  return (
    db.prepare(`SELECT id FROM s WHERE ${where} ORDER BY id`).all(...params) as {
      id: number;
    }[]
  ).map((r) => r.id);
}

describe("skill text terms", () => {
  it("splits on | and drops empty or bare-wildcard terms", () => {
    assert.deepEqual(parseSkillTextTerms(" by * turn |  | reduce damage | * "), [
      "by * turn",
      "reduce damage",
    ]);
    assert.deepEqual(parseSkillTextTerms(""), []);
  });

  it("treats wildcard terms literally and keeps * inside one clause", () => {
    assert.equal(skillGlobMatch("2x (atk) * TURN", "For 1 turn, 2x (ATK) for 3 turns"), 1);
    assert.equal(skillGlobMatch("a.c*", "abc"), 0);
    assert.equal(skillGlobMatch("taken * turns", "taken by 5%; for 2 turns"), 0);
  });

  it("stays fast on many wildcards (no backtracking)", () => {
    const text = "e".repeat(5000);
    const started = Date.now();
    assert.equal(skillGlobMatch(`${"e*".repeat(40)}zzz`, text), 0);
    assert.ok(Date.now() - started < 200);
  });

  it("ANDs every term and matches * across numbers, not across ;", () => {
    const db = memoryDb();
    const run = (raw: string) => {
      const params: unknown[] = [];
      const where = skillTextTermsSql(raw, "txt", params);
      assert.ok(where);
      return ids(db, where, params);
    };
    assert.deepEqual(run("by * turn"), [1, 2, 4]);
    assert.deepEqual(run("BY * TURN | unlock"), [1]);
    assert.deepEqual(run("reduce damage | for * turns"), [3]);
    // "taken by 50%; Delay by 3 turns" — * must not jump over the ';'.
    assert.deepEqual(run("taken * turns"), []);
    assert.deepEqual(run("50%"), [3, 4]);
  });
});

describe("active skill cooldown", () => {
  it("uses a range with both bounds and equality with one", () => {
    const db = memoryDb();
    const run = (min: number | null, max: number | null) => {
      const params: unknown[] = [];
      const where = cooldownSql(min, max, "cd", params);
      return where ? ids(db, where, params) : null;
    };
    assert.deepEqual(run(5, 8), [1, 2, 3]);
    assert.deepEqual(run(8, null), [2, 3]);
    assert.deepEqual(run(null, 12), [4]);
    assert.equal(run(null, null), null);
  });
});

describe("effect clause turns", () => {
  const turnsOf = (text: string, needle: string) => {
    const at = text.indexOf(needle);
    assert.ok(at >= 0, needle);
    return effectClauseTurns(text, at, at + needle.length);
  };

  it("reads the For N turns prefix of the same clause only", () => {
    const text =
      "For 4 turns, set damage cap of Fire allies to 10,000,000,000; For 1 turn, reduce damage taken by 35%; Charge all allies' skills by 1 turn";
    assert.equal(turnsOf(text, "reduce damage taken by 35%"), 1);
    assert.equal(turnsOf(text, "set damage cap"), 4);
    assert.equal(turnsOf(text, "Charge all allies"), null);
  });

  it("splits evolving / random lists and conditions", () => {
    const text =
      "Activate a random skill from the list: 1) Delay enemies' next attack by 2 turns, 2) For 3 turns, 2x orb move time, 3) For 1 turn, reduce damage taken by 75%";
    assert.equal(turnsOf(text, "reduce damage taken by 75%"), 1);
    assert.equal(turnsOf(text, "2x orb move time"), 3);
    assert.equal(
      turnsOf("If HP >= 50%: For 9,999 turns, bypass void damage shield effects", "bypass void"),
      9999
    );
  });

  it("falls back to a trailing for N turns", () => {
    assert.equal(turnsOf("Change own Att. to Light for 5 turns", "Change own Att. to"), 5);
  });

  it("combines value and duration on the same match", () => {
    const re = "reduce damage taken[^.;]*?by (\\d+)%";
    const text =
      "For 5 turns, reduce damage taken by 35%; For 1 turn, reduce damage taken by 100%";
    assert.equal(effectMatch(re, 1, text, 100, null, 2, null), 0);
    assert.equal(effectMatch(re, 1, text, 100, null, 1, 1), 1);
    assert.equal(effectMatch(re, 1, text, 30, 40, 5, null), 1);
    // Presence-only matcher: value bounds are ignored.
    assert.equal(effectMatch("reduce damage taken", 0, text, 999, 999, 5, 5), 1);
  });
});

describe("dadguide effect families", () => {
  const families = (
    JSON.parse(
      readFileSync(
        path.join(root, "exports/patterns/effect_value_families.json"),
        "utf8"
      )
    ) as EffectValueFamiliesFile
  ).families;

  it("maps every family tag to an existing chip", () => {
    const groups = JSON.parse(
      readFileSync(path.join(root, "exports/patterns/patterns_group.json"), "utf8")
    ) as Record<string, { tags: { tag_id: number | null; tag_name_en: string }[] }[]>;
    const keys = (k: string) =>
      new Set(
        groups[k].flatMap((c) =>
          c.tags.map((t) => (t.tag_id != null ? String(t.tag_id) : t.tag_name_en))
        )
      );
    const active = keys("active_skill_filters");
    const leader = keys("leader_skill_filters");
    for (const f of families) {
      for (const t of f.tags?.active_skill ?? []) assert.ok(active.has(t), `${f.id} → ${t}`);
      for (const t of f.tags?.leader_skill ?? []) assert.ok(leader.has(t), `${f.id} → ${t}`);
      if (f.supports_value === false) {
        assert.ok(f.matchers.every((m) => m.value_group === 0), f.id);
      }
    }
  });

  it("filters shield value and turns in SQL like a direct scan", {
    skip: existsSync(dbPath) ? false : "seed/dadguide.sqlite not found",
  }, () => {
    const db = new Database(dbPath, { readonly: true });
    registerSqliteRegexp(db);
    const shield = families.find((f) => f.id === "shield_percent")!;
    const matcher = shield.matchers.find((m) => m.skill_type === "active_skill")!;
    const rows = db
      .prepare(
        "SELECT active_skill_id AS id, desc_en AS d FROM active_skills WHERE desc_en IS NOT NULL"
      )
      .all() as { id: number; d: string }[];

    const expected = new Set<number>();
    for (const row of rows) {
      const re = new RegExp(matcher.regex, "gi");
      for (const m of row.d.matchAll(re)) {
        const turns = effectClauseTurns(row.d, m.index!, m.index! + m[0].length);
        if (Number(m[1]) >= 50 && turns != null && turns >= 2 && turns <= 3) {
          expected.add(row.id);
        }
      }
    }
    const actual = new Set(
      (
        db
          .prepare(
            "SELECT active_skill_id AS id FROM active_skills WHERE effect_match(?, 1, desc_en, 50, NULL, 2, 3) = 1"
          )
          .all(matcher.regex) as { id: number }[]
      ).map((r) => r.id)
    );
    db.close();
    assert.ok(expected.size > 0);
    assert.deepEqual(actual, expected);
  });
});
