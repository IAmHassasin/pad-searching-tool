import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import type { EffectValueFamiliesFile } from "../patterns/effect-value-types.ts";
import {
  effectClauseTurns,
  effectLoopMatch,
  effectMatch,
  registerSqliteRegexp,
} from "../patterns/register-sqlite-regexp.ts";
import {
  effectDurationLoops,
  loopCopyCount,
  skillChargeChargesPerTurnSql,
  stageCooldownAt,
} from "../patterns/skill-charge-sql.ts";
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

describe("active effect loop", () => {
  const text14255 =
    "For 2 turns, bypass void damage shield effects; For 2 turns, bypass damage absorb shield effects; For 2 turns, create 1 spinner restricted to Wood, Dark, and Heal orbs; For 2 turns, set damage cap of self to 40,000,000,000";
  const text13413 =
    "For 8 turns, set damage cap of self to 26,000,000,000; For 3 turns, bypass att. absorb and damage absorb shield effects; For 3 turns, bypass void damage shield effects";
  const text8765 =
    "Create 2 spinners that change every 1.0s for 8 turns; For 8 turns, 2x orb move time; For 8 turns, 2x ATK for this monster; For 8 turns, set damage cap of self to 26,000,000,000";

  const families = (
    JSON.parse(
      readFileSync(
        path.join(root, "exports/patterns/effect_value_families.json"),
        "utf8"
      )
    ) as EffectValueFamiliesFile
  ).families;

  const regexOf = (id: string) => {
    const family = families.find((f) => f.id === id);
    assert.ok(family, id);
    return {
      regex: family.matchers[0].regex,
      group: family.matchers[0].value_group,
    };
  };

  const loops = (
    id: string,
    text: string,
    cd: number,
    charges: number,
    copies = 1
  ) => {
    const { regex, group } = regexOf(id);
    return effectLoopMatch(
      regex,
      group,
      text,
      null,
      null,
      null,
      null,
      cd,
      charges,
      null,
      copies
    );
  };

  it("keeps an effect up when duration is at least the charged cooldown", () => {
    assert.equal(effectDurationLoops(8, 10, 2), true);
    assert.equal(effectDurationLoops(3, 10, 2), false);
    assert.equal(effectDurationLoops(8, 18, 3), true);
    assert.equal(effectDurationLoops(2, 3, 1), false);
    assert.equal(effectDurationLoops(5, 5, 1), true);
    // Odd cooldowns round up. Equal to that rounded CD still loops.
    assert.equal(effectDurationLoops(5, 11, 2), false);
    assert.equal(effectDurationLoops(6, 11, 2), true);
    assert.equal(effectDurationLoops(8, null, 2), false);
    // A bad copy count must not fall back to a wider match.
    assert.equal(loopCopyCount(null), 1);
    assert.equal(loopCopyCount(4), null);
    assert.equal(effectDurationLoops(2, 3, 1, 4), false);
  });

  it("loops shorter effects when 2 or 3 copies share the cooldown", () => {
    // CD 3, no skill charge. A 2-turn effect needs a second copy.
    assert.equal(effectDurationLoops(2, 3, 1, 1), false);
    assert.equal(effectDurationLoops(2, 3, 1, 2), true);
    // CD 5 needs three copies before a 2-turn effect covers the gap.
    assert.equal(effectDurationLoops(2, 5, 1, 2), false);
    assert.equal(effectDurationLoops(2, 5, 1, 3), true);
    // 13413 absorb is 3 turns against a charged CD of 5.
    assert.equal(effectDurationLoops(3, 10, 2, 1), false);
    assert.equal(effectDurationLoops(3, 10, 2, 2), true);

    assert.equal(loops("bypass_void_damage", text14255, 3, 1, 1), 0);
    assert.equal(loops("bypass_void_damage", text14255, 3, 1, 2), 1);
    assert.equal(loops("bypass_dmg_absorb", text13413, 10, 2, 1), 0);
    assert.equal(loops("bypass_dmg_absorb", text13413, 10, 2, 2), 1);
  });

  it("matches the sample actives effect by effect", () => {
    // 14255: CD 3, no skill charge. Every effect lasts 2 turns.
    for (const id of [
      "bypass_void_damage",
      "bypass_dmg_absorb",
      "create_spinner",
      "damage_cap_buff",
    ]) {
      assert.equal(loops(id, text14255, 3, 1), 0, id);
    }

    // 13413: CD 10 + awk 51 → 5. Only the 8-turn damage cap loops.
    assert.equal(loops("damage_cap_buff", text13413, 10, 2), 1);
    assert.equal(loops("bypass_att_absorb", text13413, 10, 2), 0);
    assert.equal(loops("bypass_dmg_absorb", text13413, 10, 2), 0);
    assert.equal(loops("bypass_void_damage", text13413, 10, 2), 0);

    // 8765: CD 18 + awk 97 → 6. Every 8-turn effect loops.
    for (const id of [
      "create_spinner",
      "movetime_multiplier",
      "active_atk_buff_multiplier",
      "damage_cap_buff",
    ]) {
      assert.equal(loops(id, text8765, 18, 3), 1, id);
    }
  });

  it("loops an evolving skill against that stage's cooldown", () => {
    const text =
      "After each skill, evolve to the next: 1) Charge all allies' skills by 2 turns; Enhance all orbs 2) For 5 turns, 1.5x HP; For 5 turns, 1.5x orb move time; For 2 turns, bypass att. absorb and damage absorb shield effects";
    const hp = regexOf("hp_burst_multiplier");
    const move = regexOf("movetime_multiplier");
    const absorb = regexOf("bypass_dmg_absorb");
    // Parent CD is stage 1 (22). Stage list is unskilled stage 1 then stage 2.
    assert.equal(stageCooldownAt(text, text.indexOf("1.5x HP"), 22, "26,5"), 5);
    assert.equal(
      effectLoopMatch(hp.regex, hp.group, text, null, null, null, null, 22, 1, "26,5"),
      1
    );
    assert.equal(
      effectLoopMatch(move.regex, move.group, text, null, null, null, null, 22, 1, "26,5"),
      1
    );
    assert.equal(
      effectLoopMatch(absorb.regex, absorb.group, text, null, null, null, null, 22, 1, "26,5"),
      0
    );
    // Stage CD 5. Two copies still leave a 3-turn gap; three copies cover 2 turns.
    assert.equal(
      effectLoopMatch(absorb.regex, absorb.group, text, null, null, null, null, 22, 1, "26,5", 2),
      0
    );
    assert.equal(
      effectLoopMatch(absorb.regex, absorb.group, text, null, null, null, null, 22, 1, "26,5", 3),
      1
    );
    // Without the stage list, the 5-turn buff is compared to CD 22 and does not loop.
    assert.equal(
      effectLoopMatch(hp.regex, hp.group, text, null, null, null, null, 22, 1, null),
      0
    );
  });

  it("counts skill charge from regular, sync, and one super awakening", () => {
    const db = new Database(":memory:");
    db.exec(
      "CREATE TABLE m (id INTEGER, regular TEXT, super TEXT, sync INTEGER)"
    );
    const insert = db.prepare("INSERT INTO m VALUES (?, ?, ?, ?)");
    insert.run(1, "", "", null);
    insert.run(2, "(51)", "", null);
    insert.run(3, "(97)", "", null);
    insert.run(4, "(51),(51)", "", null);
    insert.run(5, "(51)", "(97),(51)", null);
    insert.run(6, "", "(51),(97)", null);
    insert.run(7, "", "", 97);
    const expr = skillChargeChargesPerTurnSql("regular", "super", "sync");
    const charge = (id: number) =>
      (db.prepare(`SELECT ${expr} AS n FROM m WHERE id = ?`).get(id) as { n: number })
        .n;
    assert.equal(charge(1), 1);
    assert.equal(charge(2), 2);
    assert.equal(charge(3), 3);
    assert.equal(charge(4), 3);
    assert.equal(charge(5), 4);
    // Both skill-charge options are supers: pick 97, do not add them.
    assert.equal(charge(6), 3);
    assert.equal(charge(7), 3);
    db.close();
  });

  it("applies loop in SQL using that card's cooldown and skill charge", () => {
    const db = new Database(":memory:");
    registerSqliteRegexp(db);
    db.exec(
      "CREATE TABLE m (id INTEGER, txt TEXT, cd INTEGER, regular TEXT, super TEXT, sync INTEGER)"
    );
    const insert = db.prepare("INSERT INTO m VALUES (?, ?, ?, ?, ?, ?)");
    insert.run(14255, text14255, 3, "", "", null);
    insert.run(13413, text13413, 10, "(51)", "", null);
    insert.run(8765, text8765, 18, "(97)", "", null);
    const charges = skillChargeChargesPerTurnSql("regular", "super", "sync");
    insert.run(5, "For 2 turns, bypass void damage shield effects", 5, "", "", null);
    const idsFor = (regex: string, group: number, copies = 1) =>
      (
        db
          .prepare(
            `SELECT id FROM m WHERE effect_loop(?, ?, txt, NULL, NULL, NULL, NULL, cd, ${charges}, NULL, ?) = 1 ORDER BY id`
          )
          .all(regex, group, copies) as { id: number }[]
      ).map((r) => r.id);

    assert.deepEqual(idsFor("damage cap", 0), [8765, 13413]);
    assert.deepEqual(idsFor("bypass void damage shield", 0), []);
    assert.deepEqual(idsFor("spinner", 0), [8765]);
    assert.deepEqual(idsFor("(?<![+\\d.])(\\d+\\.?\\d*)x orb move time", 1), [8765]);
    assert.deepEqual(idsFor("(?<![+\\d.])(\\d+\\.?\\d*)x ATK for", 1), [8765]);
    // Two copies pull in the 2-turn and 3-turn effects that one copy cannot hold.
    assert.deepEqual(idsFor("damage cap", 0, 2), [8765, 13413, 14255]);
    assert.deepEqual(idsFor("bypass void damage shield", 0, 2), [13413, 14255]);
    // CD 5, 2 turns: only three copies close the gap.
    assert.deepEqual(idsFor("bypass void damage shield", 0, 3), [5, 13413, 14255]);
    db.close();
  });
});
