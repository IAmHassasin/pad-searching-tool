import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import {
  appendEffectTagClause,
  joinEffectClauses,
  skillTagTokenSql,
  skillTagsIncludeId,
  type EffectColumnExprs,
} from "../patterns/effect-filter-sql.ts";
import type { SkillType } from "../patterns/pattern-types.ts";
import { registerSqliteRegexp } from "../patterns/register-sqlite-regexp.ts";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const dbPath = path.join(root, "seed/dadguide.sqlite");

const EXPRS: EffectColumnExprs = {
  activeTags: '_src."active_skill_tags"',
  leaderTags: '_src."leader_skill_tags"',
  monsterId: '_src."monster_id"',
};

type OfficialTag = {
  skillType: SkillType;
  tagId: number;
  label: string;
};

type MonsterEffects = {
  id: number;
  active: string;
  leader: string;
  subs: string[];
};

function tagKey(tag: OfficialTag): string {
  return `${tag.skillType}:${tag.tagId}`;
}

function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const cur: T[] = [];
  const walk = (start: number) => {
    if (cur.length === k) {
      out.push(cur.slice());
      return;
    }
    for (let i = start; i <= items.length - (k - cur.length); i++) {
      cur.push(items[i]);
      walk(i + 1);
      cur.pop();
    }
  };
  walk(0);
  return out;
}

function loadOfficialTags(): OfficialTag[] {
  const groups = JSON.parse(
    readFileSync(path.join(root, "exports/patterns/patterns_group.json"), "utf8")
  ) as {
    active_skill_filters: { tags: { tag_id: number | null; label: string }[] }[];
    leader_skill_filters: { tags: { tag_id: number | null; label: string }[] }[];
  };
  const out: OfficialTag[] = [];
  const push = (
    skillType: SkillType,
    cats: { tags: { tag_id: number | null; label: string }[] }[]
  ) => {
    for (const cat of cats) {
      for (const tag of cat.tags) {
        if (tag.tag_id == null) continue;
        out.push({ skillType, tagId: tag.tag_id, label: tag.label });
      }
    }
  };
  push("active_skill", groups.active_skill_filters);
  push("leader_skill", groups.leader_skill_filters);
  return out;
}

function monsterHas(row: MonsterEffects, tag: OfficialTag): boolean {
  if (tag.skillType === "leader_skill") {
    return skillTagsIncludeId(row.leader, tag.tagId);
  }
  if (skillTagsIncludeId(row.active, tag.tagId)) return true;
  return row.subs.some((tags) => skillTagsIncludeId(tags, tag.tagId));
}

function compileWhere(
  combo: OfficialTag[],
  patternMatch: "any" | "all"
): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const parts = combo.map((tag) =>
    appendEffectTagClause(tag.skillType, tag.tagId, EXPRS, params)
  );
  const sql = joinEffectClauses(parts, patternMatch);
  if (!sql) throw new Error("empty effect clause");
  return { sql, params };
}

function setFromIds(ids: Iterable<number>): Set<number> {
  return new Set(ids);
}

function formatMiss(
  combo: OfficialTag[],
  mode: "any" | "all",
  missing: number[],
  extra: number[]
): string {
  const name = combo.map((t) => `${t.label}#${t.tagId}`).join(" + ");
  return (
    `${mode} [${name}] missing ${missing.length} (e.g. ${missing.slice(0, 5).join(",")})` +
    ` extra ${extra.length} (e.g. ${extra.slice(0, 5).join(",")})`
  );
}

describe("effect clause joiner", () => {
  it("ands every selected effect and ors the any mode", () => {
    assert.equal(joinEffectClauses(["a", "b", "c"], "all"), "(a AND b AND c)");
    assert.equal(joinEffectClauses(["a", "b"], "any"), "(a OR b)");
    assert.equal(joinEffectClauses([], "all"), null);
  });
});

describe("custom effect patterns", () => {
  it("matches each custom pattern's example text", () => {
    const patterns = JSON.parse(
      readFileSync(
        path.join(root, "exports/patterns/pad_generated_patterns.json"),
        "utf8"
      )
    ).patterns as Array<{
      tag_id: number | null;
      tag_name_en: string;
      regex_pattern: string;
      example_matched_text: string;
    }>;
    const misses: string[] = [];
    for (const pattern of patterns) {
      if (pattern.tag_id != null) continue;
      let matched = false;
      try {
        matched = new RegExp(pattern.regex_pattern, "i").test(
          pattern.example_matched_text
        );
      } catch (error) {
        misses.push(`${pattern.tag_name_en}: invalid regex ${String(error)}`);
        continue;
      }
      if (!matched) {
        misses.push(
          `${pattern.tag_name_en}: ${pattern.example_matched_text}`
        );
      }
    }
    assert.deepEqual(misses, []);

    const multi = patterns.find(
      (pattern) => pattern.tag_name_en === "create_orbs_multiple"
    );
    const multiRe = new RegExp(multi!.regex_pattern, "i");
    assert.equal(multiRe.test("Create 2 Fire and Water orbs"), true);
    assert.equal(multiRe.test("Create 3 Heal orbs"), false);

    const atkRes = patterns
      .filter(
        (pattern) =>
          pattern.tag_name_en === "enhanced_atk_multi_attribute_match"
      )
      .map((pattern) => new RegExp(pattern.regex_pattern, "i"));
    const atkHits = (text: string) => atkRes.some((re) => re.test(text));
    assert.equal(atkHits("4x ATK when matching Fire and Water"), true);
    assert.equal(
      atkHits("2.5x ATK when matching Fire, Water, and Wood at once"),
      true
    );
  });
});

describe("skill tag tokens", () => {
  it("matches a tag id without matching a longer id", () => {
    assert.equal(skillTagsIncludeId("(19),(190),(119)", 19), true);
    assert.equal(skillTagsIncludeId("(190)", 19), false);
    assert.equal(skillTagsIncludeId("(119)", 19), false);
    assert.equal(skillTagsIncludeId("(19)", 1), false);
    assert.equal(skillTagsIncludeId(" (19), (80) ", 80), true);
    assert.equal(skillTagsIncludeId(null, 19), false);
    assert.equal(skillTagsIncludeId("", 19), false);
  });

  it("uses the same token rule in SQL", () => {
    const db = new Database(":memory:");
    const sql = `SELECT ${skillTagTokenSql("tags")} AS hit FROM (SELECT ? AS tags)`;
    const query = db.prepare(sql);
    const samples: Array<[string | null, number, boolean]> = [
      ["(19),(190)", 19, true],
      ["(190)", 19, false],
      ["(119),(19)", 19, true],
      [" (80), (3) ", 3, true],
      [null, 12, false],
    ];
    for (const [tags, id, expected] of samples) {
      const row = query.get(String(id), tags) as { hit: number };
      assert.equal(row.hit, expected ? 1 : 0, `${tags} / ${id}`);
      assert.equal(skillTagsIncludeId(tags, id), expected);
    }
    db.close();
  });
});

describe("skill description regexp", () => {
  it("matches effect text regardless of capitalization", () => {
    const db = new Database(":memory:");
    registerSqliteRegexp(db);
    const hit = db.prepare("SELECT regexp(?, ?) AS hit");
    assert.equal(hit.get("Recover all HP", "recover all HP")?.hit, 1);
    assert.equal(
      hit.get("For (\\d+) turn(?:s)?, (\\d+)x ATK", "for 2 turns, 3x atk")?.hit,
      1
    );
    assert.equal(hit.get("Unlock all orbs", "Change all orbs")?.hit, 0);
    db.close();
  });
});

describe("dadguide effect filters", () => {
  it("returns every monster whose skill tags contain each effect, including combos of 2 and 3", {
    skip: existsSync(dbPath) ? false : "seed/dadguide.sqlite is not present",
  }, () => {
    const tags = loadOfficialTags();
    assert.ok(tags.length >= 40, `expected official effect tags, got ${tags.length}`);

    const db = new Database(dbPath, { readonly: true, fileMustExist: true });

    const monsters = db
      .prepare(
        `SELECT m.monster_id AS id,
                COALESCE(a.tags, '') AS active,
                COALESCE(l.tags, '') AS leader
         FROM monsters m
         LEFT JOIN active_skills a ON a.active_skill_id = m.active_skill_id
         LEFT JOIN leader_skills l ON l.leader_skill_id = m.leader_skill_id`
      )
      .all() as Array<{ id: number; active: string; leader: string }>;

    const subs = db
      .prepare(
        `SELECT m.monster_id AS id, s.tags AS tags
         FROM monsters m
         JOIN active_skills_subskills ss ON ss.active_skill_id = m.active_skill_id
         JOIN active_subskills s ON s.active_subskill_id = ss.active_subskill_id
         WHERE s.tags IS NOT NULL AND TRIM(s.tags) != ''`
      )
      .all() as Array<{ id: number; tags: string }>;

    const byId = new Map<number, MonsterEffects>();
    for (const row of monsters) {
      byId.set(row.id, {
        id: row.id,
        active: row.active,
        leader: row.leader,
        subs: [],
      });
    }
    for (const sub of subs) {
      const row = byId.get(sub.id);
      if (row) row.subs.push(sub.tags);
    }

    const truth = new Map<string, Set<number>>();
    for (const tag of tags) {
      const ids = new Set<number>();
      for (const row of byId.values()) {
        if (monsterHas(row, tag)) ids.add(row.id);
      }
      truth.set(tagKey(tag), ids);
    }

    db.exec(`
      CREATE TEMP TABLE effect_src AS
      SELECT m.monster_id AS monster_id,
             a.tags AS active_skill_tags,
             l.tags AS leader_skill_tags
      FROM monsters m
      LEFT JOIN active_skills a ON a.active_skill_id = m.active_skill_id
      LEFT JOIN leader_skills l ON l.leader_skill_id = m.leader_skill_id
    `);

    const run = (combo: OfficialTag[], mode: "any" | "all"): number[] => {
      const { sql, params } = compileWhere(combo, mode);
      const rows = db
        .prepare(`SELECT monster_id AS id FROM effect_src AS _src WHERE ${sql}`)
        .all(...params) as Array<{ id: number }>;
      return rows.map((row) => row.id);
    };

    const expectedIds = (combo: OfficialTag[], mode: "any" | "all"): Set<number> => {
      if (mode === "any") {
        const acc = new Set<number>();
        for (const tag of combo) {
          for (const id of truth.get(tagKey(tag)) ?? []) acc.add(id);
        }
        return acc;
      }
      const [first, ...rest] = combo;
      const acc = new Set(truth.get(tagKey(first)));
      for (const tag of rest) {
        const have = truth.get(tagKey(tag)) ?? new Set<number>();
        for (const id of acc) {
          if (!have.has(id)) acc.delete(id);
        }
      }
      return acc;
    };

    const failures: string[] = [];
    const checkSets = (
      combo: OfficialTag[],
      mode: "any" | "all",
      actual: Set<number>
    ) => {
      const expected = expectedIds(combo, mode);
      if (actual.size === expected.size) {
        let same = true;
        for (const id of expected) {
          if (!actual.has(id)) {
            same = false;
            break;
          }
        }
        if (same) return;
      }
      const missing: number[] = [];
      const extra: number[] = [];
      for (const id of expected) if (!actual.has(id)) missing.push(id);
      for (const id of actual) if (!expected.has(id)) extra.push(id);
      failures.push(formatMiss(combo, mode, missing, extra));
    };
    const checkSql = (combo: OfficialTag[], mode: "any" | "all") => {
      checkSets(combo, mode, setFromIds(run(combo, mode)));
    };

    const started = Date.now();
    const sqlSets = new Map<string, Set<number>>();
    for (const tag of tags) {
      const ids = setFromIds(run([tag], "all"));
      sqlSets.set(tagKey(tag), ids);
      checkSets([tag], "all", ids);
    }
    if (failures.length) {
      db.close();
      assert.deepEqual(failures, []);
    }

    const pairs = combinations(tags, 2);
    for (const combo of pairs) checkSql(combo, "all");

    // Every 3-effect combo is the intersection of the single-effect SQL
    // results (those already matched the skill-tag ground truth). Re-run the
    // combined statement on a stride so parameter order for 3 clauses is
    // checked without a full extra pass over every triple.
    const triples = combinations(tags, 3);
    let sqlTriples = 0;
    for (let i = 0; i < triples.length; i++) {
      const combo = triples[i];
      if (failures.length >= 12) break;
      const [a, b, c] = combo;
      const inter = new Set(sqlSets.get(tagKey(a)));
      const second = sqlSets.get(tagKey(b)) ?? new Set<number>();
      const third = sqlSets.get(tagKey(c)) ?? new Set<number>();
      for (const id of inter) {
        if (!second.has(id) || !third.has(id)) inter.delete(id);
      }
      checkSets(combo, "all", inter);
      if (i % 40 === 0) {
        checkSql(combo, "all");
        sqlTriples++;
      }
    }

    if (failures.length < 12) {
      for (let i = 0; i < pairs.length; i += 8) {
        checkSql(pairs[i], "any");
        if (failures.length >= 12) break;
      }
    }

    db.close();
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(
      `effect filters: ${tags.length} tags, ${pairs.length} pairs, ${triples.length} triples (${sqlTriples} rechecked in SQL) in ${seconds}s`
    );
    assert.deepEqual(failures, []);
  });
});
