#!/usr/bin/env node
/**
 * Resolve the hardest hit ("max hit") of every team-build catalog entry
 * (web/src/lib/team-build/dungeon-catalog.json).
 *
 * 1. AppMedia — find the dungeon's guide (catalog sourceUrl, the 降臨 / ゲリラ /
 *    テクニカル index pages, then WP search), verify its title names the
 *    dungeon, and import the 先制ギミック早見表 with import-dungeon.mjs so the
 *    dungeon joins the Dungeon details seeds; the entry gets `appmediaPostId`.
 *    Guides without that table fall back to the tables mentioning 先制.
 * 2. Kamigame — index pages → dungeon page → 「出現する敵と注意点」 table.
 * Fallback results are stored on the entry as `maxHit` (value, raw line, source).
 *
 * Usage:
 *   node dungeon-details/scripts/resolve-catalog-max-hits.mjs [--dry-run] [--only <text>]
 *        [--limit N] [--skip-appmedia] [--skip-kamigame] [--cache <dir>] [--report <file>]
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { promisify } from "node:util";

const require_mod = () => createRequire(import.meta.url);
const require_fs = () => require_mod()("node:fs");
import * as cheerio from "cheerio";
import { findMaxDamageInEnemyTables } from "../lib/enemy-tables.mjs";
import { parseKamigameMaxDamage } from "../lib/kamigame-max-damage.mjs";
import { parseDungeonFloorTable } from "../lib/parse-dungeon-table.mjs";

const execFileAsync = promisify(execFile);
const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(moduleRoot, "..");
const CATALOG_PATH = join(repoRoot, "web/src/lib/team-build/dungeon-catalog.json");
const SEED_DIR = join(moduleRoot, "seed/dungeons");
const SQLITE_PATH = join(moduleRoot, "seed/dungeons.sqlite");
const URLS_PATH = join(moduleRoot, "seed/dungeon-urls.txt");
const IMPORT_SCRIPT = join(moduleRoot, "scripts/import-dungeon.mjs");
const UA = "pad-searching-tool/dungeon-details";
const APPMEDIA = "https://appmedia.jp";
const KAMIGAME = "https://kamigame.jp";
/** AppMedia index posts: 降臨一覧, ゲリラ一覧, テクニカル一覧. */
const APPMEDIA_INDEX_POSTS = [467565, 83349, 27375504];
const KAMIGAME_INDEX_PATHS = [
  "/puzzle-dragons/ダンジョン/index.html",
  "/puzzle-dragons/ダンジョン/テクニカルダンジョン/index.html",
  "/puzzle-dragons/ダンジョン/スペシャルダンジョン/index.html",
  "/puzzle-dragons/ダンジョン/ゲリラ/index.html",
  "/puzzle-dragons/ダンジョン/降臨/index.html",
];
const DELAY_MS = 250;

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    only: null,
    limit: Infinity,
    skipAppmedia: false,
    skipKamigame: false,
    cache: null,
    report: null,
    verbose: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--only" && argv[i + 1]) opts.only = argv[++i];
    else if (a === "--limit" && argv[i + 1]) opts.limit = Number(argv[++i]);
    else if (a === "--skip-appmedia") opts.skipAppmedia = true;
    else if (a === "--skip-kamigame") opts.skipKamigame = true;
    else if (a === "--cache" && argv[i + 1]) opts.cache = resolve(process.cwd(), argv[++i]);
    else if (a === "--report" && argv[i + 1]) opts.report = resolve(process.cwd(), argv[++i]);
    else if (a === "--verbose") opts.verbose = true;
    else throw new Error(`Unknown option: ${a}`);
  }
  return opts;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Small on-disk cache so reruns do not hammer the sites. */
function makeFetcher(cacheDir) {
  if (cacheDir) mkdirSync(cacheDir, { recursive: true });
  const memo = new Map();
  return async function fetchText(url) {
    if (memo.has(url)) return memo.get(url);
    // Hash the URL: percent-encoded Japanese paths are far longer than a file name allows.
    const key = cacheDir
      ? join(cacheDir, `${createHash("sha1").update(url).digest("hex")}-${encodeURIComponent(url).slice(0, 40)}`)
      : null;
    if (key && existsSync(key)) {
      const cached = readFileSync(key, "utf8");
      memo.set(url, cached);
      return cached;
    }
    await sleep(DELAY_MS);
    const res = await fetch(url, { headers: { "user-agent": UA } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const text = await res.text();
    if (key) writeFileSync(key, text, "utf8");
    memo.set(url, text);
    return text;
  };
}

const strip = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Comparable form: NFKC, no spaces, no 【】 qualifiers. Parentheses are kept
 * (after NFKC they are ASCII) because guides often name the dungeon only
 * there: "凶兆チャレンジ(潰滅の兆龍)の攻略".
 */
function norm(s) {
  return (s ?? "")
    .normalize("NFKC")
    .replace(/&amp;/g, "&")
    .replace(/【[^】]*】/g, "")
    .replace(/[\s　・･!！?？]/g, "")
    .trim();
}

/** Dungeon-identifying part of a catalog name: "天空の儚域／天穹の神王【超重力】" → "天穹の神王". */
function bossToken(entry) {
  let name = entry.nameJa
    .replace(/【[^】]*】/g, "")
    .replace(/（[^）]*）|\([^)]*\)/g, "")
    .replace(/\s+\d+\/\d+\s*$/, "")
    .trim();
  const parts = name.split("／");
  return parts[parts.length - 1].trim();
}

const CJK_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]/u;

/**
 * Every token of the boss name (years ignored) must appear as a whole name:
 * the character before it must not be kanji / kana, so "極悪生命体" does not
 * match "暴乱の極悪生命体" and a non-裏 name never matches its 裏 variant.
 */
function titleMatches(title, token) {
  const t = norm(title);
  const words = token.split(/\s+/).filter((w) => w && !/^\d{4}$/.test(w)).map(norm);
  if (!words.length) return false;
  const main = words[0];
  let found = false;
  for (let idx = t.indexOf(main); idx >= 0; idx = t.indexOf(main, idx + 1)) {
    if (idx === 0 || !CJK_RE.test(t[idx - 1])) {
      found = true;
      break;
    }
  }
  if (!found) return false;
  for (const w of words.slice(1)) if (!t.includes(w)) return false;
  return true;
}

function labelMatches(label, token) {
  const l = norm(label);
  const b = norm(token.split(/\s+/)[0]);
  if (!l || !b) return false;
  if (b.startsWith("裏") !== l.startsWith("裏")) return false;
  return l.includes(b) || (l.length >= 3 && b.includes(l));
}

/**
 * Guide nicknames AppMedia / Kamigame use instead of the boss name
 * (未知の新星 family: 百式 / 千手 / 万寿 / 凶兆 / 億兆 チャレンジ).
 */
const BOSS_ALIASES = [
  [/億兆龍$/, "億兆チャレンジ"],
  [/兆龍$/, "凶兆チャレンジ"],
  [/万龍$/, "万寿チャレンジ"],
  [/千龍$/, "千手チャレンジ"],
  [/百龍$/, "百式チャレンジ"],
  [/極悪生命体$/, "極悪チャレンジ"],
];

function aliasTokens(token) {
  const out = [];
  const ura = token.startsWith("裏");
  for (const [re, alias] of BOSS_ALIASES) {
    if (re.test(token)) out.push(ura ? `裏${alias}` : alias);
  }
  // 奈落の重界 / 天空の儚域 bosses "珊瑚の龍王" are covered as "珊瑚チャレンジ".
  const m = token.match(/^(..)の..$/);
  if (m) out.push(`${m[1]}チャレンジ`);
  return out;
}

function appmediaPostIdFromUrl(url) {
  const m = url.match(/appmedia\.jp\/(?:pazudora\/(\d+)|\?p=(\d+))/);
  return m ? Number(m[1] ?? m[2]) : null;
}

/**
 * Max well-formed damage inside the enemy tables of an AppMedia guide that
 * has no readable 先制ギミック早見表 (see enemy-tables.mjs for the rules).
 */
function legacyAppmediaMaxDamage(html, onInvalid) {
  return findMaxDamageInEnemyTables(html, { onInvalid });
}

async function main() {
  const opts = parseArgs(process.argv);
  const fetchText = makeFetcher(opts.cache);
  const catalogRaw = readFileSync(CATALOG_PATH, "utf8");
  const crlf = catalogRaw.includes("\r\n");
  const catalog = JSON.parse(catalogRaw);

  const seeds = new Map();
  const effectCount = (floors) =>
    (floors ?? []).reduce((n, f) => n + (f.spawns ?? []).reduce((m, s) => m + (s.effects?.length ?? 0), 0), 0);
  const pruned = [];
  if (existsSync(SEED_DIR)) {
    for (const name of (await import("node:fs")).readdirSync(SEED_DIR)) {
      if (!/^\d+\.json$/.test(name)) continue;
      const seed = JSON.parse(readFileSync(join(SEED_DIR, name), "utf8"));
      if (effectCount(seed.floors) === 0) {
        // An empty floor table is useless in Dungeon details; drop it and let
        // the entry fall back to the legacy / Kamigame parsers.
        pruned.push(seed.appmediaPostId);
        if (!opts.dryRun) pruneSeed(seed.appmediaPostId, name);
        continue;
      }
      seeds.set(seed.appmediaPostId, seed);
    }
  }
  if (pruned.length) {
    console.log(`Pruned ${pruned.length} empty seed(s): ${pruned.join(", ")}`);
    for (const entry of catalog.dungeons) {
      if (pruned.includes(entry.appmediaPostId)) delete entry.appmediaPostId;
    }
  }

  function pruneSeed(postId, name) {
    (require_fs()).unlinkSync(join(SEED_DIR, name));
    if (existsSync(URLS_PATH)) {
      const lines = readFileSync(URLS_PATH, "utf8").split(/\r?\n/);
      writeFileSync(URLS_PATH, lines.filter((l) => !l.includes(`/${postId}`)).join("\n"), "utf8");
    }
    if (existsSync(SQLITE_PATH)) {
      try {
        const Database = (require_mod())("better-sqlite3");
        const db = new Database(SQLITE_PATH);
        db.prepare("DELETE FROM dungeons WHERE appmedia_post_id = ?").run(postId);
        db.close();
      } catch (e) {
        console.warn(`  sqlite prune ${postId}: ${e.message}`);
      }
    }
  }

  // ---- AppMedia helpers -------------------------------------------------
  const postCache = new Map();
  async function wpPost(id) {
    if (postCache.has(id)) return postCache.get(id);
    const text = await fetchText(`${APPMEDIA}/wp-json/wp/v2/posts/${id}?_fields=id,title,link,content`);
    const json = JSON.parse(text);
    const post = {
      id: json.id,
      title: strip(json.title?.rendered ?? ""),
      link: json.link ?? `${APPMEDIA}/pazudora/${id}`,
      html: json.content?.rendered ?? "",
    };
    postCache.set(id, post);
    return post;
  }
  async function wpSearch(query) {
    const text = await fetchText(
      `${APPMEDIA}/wp-json/wp/v2/posts?search=${encodeURIComponent(query)}&per_page=25&_fields=id,title,link`
    );
    return JSON.parse(text).map((p) => ({ id: p.id, title: strip(p.title?.rendered ?? ""), link: p.link }));
  }
  const appmediaIndex = [];
  if (!opts.skipAppmedia) {
    for (const id of APPMEDIA_INDEX_POSTS) {
      try {
        const post = await wpPost(id);
        for (const m of post.html.matchAll(/<a\s[^>]*href="[^"]*(?:\/pazudora\/|\?p=)(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) {
          const label = strip(m[2]);
          if (label && !label.includes("一覧")) appmediaIndex.push({ id: Number(m[1]), label });
        }
      } catch (e) {
        console.warn(`AppMedia index ${id} failed: ${e.message}`);
      }
    }
    console.log(`AppMedia index links: ${appmediaIndex.length}`);
  }

  async function importSeed(postId) {
    if (seeds.has(postId)) return seeds.get(postId);
    if (opts.dryRun) return { appmediaPostId: postId, maxDamage: null, dryRun: true };
    await execFileAsync(
      process.execPath,
      [IMPORT_SCRIPT, String(postId), "--out", SEED_DIR, "--sqlite", SQLITE_PATH],
      { cwd: repoRoot, timeout: 120_000, windowsHide: true }
    );
    const seed = JSON.parse(readFileSync(join(SEED_DIR, `${postId}.json`), "utf8"));
    seeds.set(postId, seed);
    const url = `${APPMEDIA}/pazudora/${postId}`;
    const current = existsSync(URLS_PATH) ? readFileSync(URLS_PATH, "utf8") : "";
    if (!current.includes(String(postId))) {
      appendFileSync(URLS_PATH, `${current.endsWith("\n") || !current ? "" : "\n"}${url}\n`, "utf8");
    }
    return seed;
  }

  /** @returns {Promise<{kind:"seed"|"legacy", postId:number, post:object, maxHit?:object}|null>} */
  async function resolveAppmedia(entry, token) {
    const tokens = [token, ...aliasTokens(token)];
    const matches = (title) => tokens.some((t) => titleMatches(title, t));
    const candidates = [];
    const fromUrl = appmediaPostIdFromUrl(entry.sourceUrl);
    // The entry's own source post is trusted without a title match when no
    // other entry shares it and it is a guide with the floor table.
    const sourceIsOwn =
      fromUrl != null && catalog.dungeons.filter((d) => d.sourceUrl === entry.sourceUrl).length === 1;
    if (fromUrl && !APPMEDIA_INDEX_POSTS.includes(fromUrl)) candidates.push(fromUrl);
    for (const { id, label } of appmediaIndex) {
      if (tokens.some((t) => labelMatches(label, t))) candidates.push(id);
    }
    for (const t of tokens) {
      try {
        for (const p of await wpSearch(t.split(/\s+/)[0])) {
          // Guides, plus the per-floor "ダンジョンデータ" posts of the arena series.
          if (matches(p.title) && /攻略|ダンジョンデータ/.test(p.title)) candidates.push(p.id);
        }
      } catch (e) {
        console.warn(`  WP search failed for ${t}: ${e.message}`);
      }
    }
    const seen = new Set();
    let legacyHit = null;
    for (const id of candidates) {
      if (seen.has(id)) continue;
      seen.add(id);
      let post;
      try {
        post = await wpPost(id);
      } catch (e) {
        console.warn(`  post ${id}: ${e.message}`);
        continue;
      }
      const trustedSource =
        id === fromUrl && sourceIsOwn && /攻略/.test(post.title) && post.html.includes("先制ギミック早見表");
      if (opts.verbose) console.log(`    AppMedia candidate ${id} "${post.title}" match=${matches(post.title)} trusted=${trustedSource}`);
      if (!matches(post.title) && !trustedSource) continue;
      // A guide with a readable floor table wins over any walkthrough-style page.
      if (post.html.includes("先制ギミック早見表")) {
        let readable = seeds.has(id);
        if (!readable) {
          try {
            readable = effectCount(parseDungeonFloorTable(post.html, [])) > 0;
          } catch {
            readable = false;
          }
        }
        if (readable) return { kind: "seed", postId: id, post };
        if (opts.verbose) console.log(`    ${id} "${post.title}": floor table not readable, trying guide tables`);
      }
      // Older guides and multi-part ダンジョンデータ posts: keep the largest hit.
      const legacy = legacyAppmediaMaxDamage(post.html, (t, raw) =>
        console.warn(`  ${post.title}: skipped malformed "${t}" in "${raw}"`)
      );
      if (legacy && (!legacyHit || legacy.value > legacyHit.maxHit.value)) {
        legacyHit = { kind: "legacy", postId: id, post, maxHit: legacy };
      }
    }
    return legacyHit;
  }

  // ---- Kamigame helpers -------------------------------------------------
  const kamigameIndex = [];
  if (!opts.skipKamigame) {
    // Index pages list only current dungeons; the Kamigame columns the
    // catalog cites (e.g. 超重力攻略) link the older ones, so harvest them too.
    const indexUrls = KAMIGAME_INDEX_PATHS.map((p) => `${KAMIGAME}${encodeURI(p)}`);
    for (const d of catalog.dungeons) {
      if (/kamigame\.jp/.test(d.sourceUrl) && !indexUrls.includes(d.sourceUrl)) indexUrls.push(d.sourceUrl);
    }
    for (const url of indexUrls) {
      try {
        const html = await fetchText(url);
        for (const m of html.matchAll(/<a\s[^>]*href="(\/puzzle-dragons\/[^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/gi)) {
          const href = m[1];
          if (/index\.html$/.test(href) || !/ダンジョン/.test(decodeURIComponent(href))) continue;
          const label = strip(m[2]);
          const base = decodeURIComponent(href).split("/").pop().replace(/\.html$/, "");
          kamigameIndex.push({ href, label, base });
        }
      } catch (e) {
        console.warn(`Kamigame index ${decodeURI(url)} failed: ${e.message}`);
      }
    }
    console.log(`Kamigame index links: ${kamigameIndex.length}`);
  }

  async function resolveKamigame(entry, token) {
    const tokens = [token, ...aliasTokens(token)];
    const hrefs = [];
    if (/kamigame\.jp/.test(entry.sourceUrl)) hrefs.push(new URL(entry.sourceUrl).pathname);
    for (const { href, label, base } of kamigameIndex) {
      if (tokens.some((t) => labelMatches(label, t) || labelMatches(base, t))) hrefs.push(href);
    }
    if (opts.verbose) console.log(`    Kamigame hrefs: ${hrefs.map((h) => decodeURIComponent(h).split("/").pop()).join(", ") || "none"}`);
    const seen = new Set();
    let best = null;
    for (const href of hrefs) {
      if (seen.has(href)) continue;
      seen.add(href);
      const url = `${KAMIGAME}${href.startsWith("/") ? "" : "/"}${href}`;
      let html;
      try {
        html = await fetchText(url);
      } catch (e) {
        console.warn(`  ${url}: ${e.message}`);
        continue;
      }
      const $ = cheerio.load(html);
      const title = `${$("h1").first().text()} ${$("title").text()}`;
      if (opts.verbose) console.log(`    Kamigame candidate ${decodeURIComponent(href)} title="${strip(title).slice(0, 60)}" match=${tokens.some((t) => titleMatches(title, t))}`);
      if (!tokens.some((t) => titleMatches(title, t))) continue;
      const hit = parseKamigameMaxDamage(html, (t, raw) =>
        console.warn(`  ${strip(title).slice(0, 40)}: skipped malformed "${t}" in "${raw}"`)
      );
      if (hit && (!best || hit.value > best.hit.value)) best = { url, hit };
    }
    return best;
  }

  // ---- main loop ----------------------------------------------------------
  const report = [];
  let handled = 0;
  for (const entry of catalog.dungeons) {
    if (opts.only && !entry.nameJa.includes(opts.only) && !entry.id.includes(opts.only)) continue;
    if (handled >= opts.limit) break;
    if (entry.appmediaPostId && seeds.has(entry.appmediaPostId)) {
      const seed = seeds.get(entry.appmediaPostId);
      let value = seed.maxDamage?.value ?? null;
      if (value == null && !entry.maxHit && !opts.skipAppmedia) {
        // Floor table without a damage line: read the rest of the guide once.
        try {
          const post = await wpPost(entry.appmediaPostId);
          const legacy = legacyAppmediaMaxDamage(post.html, () => {});
          if (legacy) {
            entry.maxHit = { value: legacy.value, raw: legacy.raw, sourceUrl: post.link, source: "appmedia" };
            value = legacy.value;
            console.log(`\n${entry.id}: seed ${entry.appmediaPostId} has no damage line → guide tables ${value.toLocaleString("en-US")} (${legacy.raw})`);
          }
        } catch (e) {
          console.warn(`  ${entry.id}: ${e.message}`);
        }
      }
      report.push({ id: entry.id, status: "seed-linked", value: value ?? entry.maxHit?.value ?? null });
      continue;
    }
    handled += 1;
    const token = bossToken(entry);
    console.log(`\n${entry.id} (${token})`);
    let done = false;

    if (!opts.skipAppmedia) {
      try {
        const am = await resolveAppmedia(entry, token);
        if (am?.kind === "seed") {
          const seed = await importSeed(am.postId);
          entry.appmediaPostId = am.postId;
          delete entry.maxHit;
          let value = seed.maxDamage?.value ?? null;
          let status = "seed-imported";
          if (value == null && !seed.dryRun) {
            // Floor table without a damage line: keep the seed for the
            // gimmick view, take the max hit from the rest of the guide.
            const legacy = legacyAppmediaMaxDamage(am.post.html, () => {});
            if (legacy) {
              entry.maxHit = { value: legacy.value, raw: legacy.raw, sourceUrl: am.post.link, source: "appmedia" };
              value = legacy.value;
              status = "seed+legacy";
            }
          }
          report.push({ id: entry.id, status, postId: am.postId, title: am.post.title, value });
          console.log(`  AppMedia seed ${am.postId} "${am.post.title}" → ${value?.toLocaleString("en-US") ?? "no damage line"}${status === "seed+legacy" ? " (from guide tables)" : ""}`);
          done = value != null || seed.dryRun === true;
        } else if (am?.kind === "legacy") {
          entry.maxHit = { value: am.maxHit.value, raw: am.maxHit.raw, sourceUrl: am.post.link, source: "appmedia" };
          report.push({ id: entry.id, status: "appmedia-legacy", postId: am.postId, title: am.post.title, value: am.maxHit.value });
          console.log(`  AppMedia legacy table ${am.postId} "${am.post.title}" → ${am.maxHit.value.toLocaleString("en-US")} (${am.maxHit.raw})`);
          done = true;
        }
      } catch (e) {
        console.warn(`  AppMedia failed: ${e.message}`);
      }
    }

    if (!done && !opts.skipKamigame) {
      try {
        const kg = await resolveKamigame(entry, token);
        if (kg) {
          entry.maxHit = {
            value: kg.hit.value,
            raw: kg.hit.raw,
            floor: kg.hit.floor,
            monsterNameJa: kg.hit.monsterNameJa,
            sourceUrl: kg.url,
            source: "kamigame",
          };
          report.push({ id: entry.id, status: "kamigame", url: kg.url, value: kg.hit.value });
          console.log(`  Kamigame ${decodeURIComponent(kg.url).split("/").pop()} → ${kg.hit.value.toLocaleString("en-US")} (${kg.hit.floor ?? "?"} ${kg.hit.raw})`);
          done = true;
        }
      } catch (e) {
        console.warn(`  Kamigame failed: ${e.message}`);
      }
    }

    if (!done) {
      report.push({ id: entry.id, status: "unresolved", token });
      console.log("  unresolved");
    }
  }

  if (!opts.dryRun) {
    let out = JSON.stringify(catalog, null, 2) + "\n";
    if (crlf) out = out.replace(/\n/g, "\r\n");
    writeFileSync(CATALOG_PATH, out, "utf8");
    console.log(`\nCatalog written: ${CATALOG_PATH}`);
  }
  if (opts.report) writeFileSync(opts.report, JSON.stringify(report, null, 2), "utf8");

  const counts = {};
  for (const r of report) counts[r.status] = (counts[r.status] ?? 0) + 1;
  console.log("\nSummary:", counts);
  const unresolved = report.filter((r) => r.status === "unresolved");
  if (unresolved.length) console.log("Unresolved:", unresolved.map((r) => `${r.id} (${r.token})`).join(", "));
}

main().catch((err) => {
  console.error(err.stack ?? err.message ?? err);
  process.exit(1);
});
