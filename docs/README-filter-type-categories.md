# Filter type categories (`filter-type-categories.json`)

This document describes the JSON-driven categorization used when you run **`npm run pad -- transform`** (or the app with **`RUN_TRANSFORM=true`**). Rules live in **`docs/filter-type-categories.json`** by default.

## What it does

For each source row (monster + joined skills from **`SOURCE_QUERY`** / **`SOURCE_TABLE`**), the transform reads every object in **`categories`**. If a rule matches the text in a configured column (usually the English active skill description), that rule’s **category key** is written to SQLite table **`pad_categorized`**.

- One source row can produce **several** `pad_categorized` rows (one per distinct matched category).
- Uniqueness is **`(sourceTable, sourceRowId, category)`**, so the same category is not duplicated for the same row.

## Database mapping

| JSON / logic | `pad_categorized` column |
|--------------|-------------------------|
| **`key`** if set, else **`label`** | **`category`** |
| **`group`** | **`subcategory`** |
| **`facets`** extractors (see below) | **`facet_json`** — JSON object, e.g. `{ "turns": 3 }` for extra filters |
| (unchanged) | **`summary_json`** — small snapshot of whitelisted source columns |

The column you match against is **not** a separate DB column; it is whatever string column exists on the **projected** source row (see **`SOURCE_COLUMN_WHITELIST`**). Typical dadguide setup uses **`active_skill_desc_en`** (alias for `active_skills.desc_en` in **`SOURCE_QUERY`**).

## When JSON rules are used

1. If **`CATEGORY_FROM_COLUMN`** is set in `.env`, categorization is taken **only** from that column (single category per row). The filter JSON is **not** applied in that mode.
2. Otherwise, if the filter JSON file **exists** and parses with a **`categories`** array, those rules run.
3. If the file is missing or invalid, the app falls back to the older placeholder logic in **`src/transform/categorize-row.ts`** (e.g. `default` / `issue` heuristics).

## Environment variables

| Variable | Purpose |
|----------|---------|
| **`FILTER_TYPE_CATEGORIES_PATH`** | Path to the JSON file. Relative paths are resolved from the process **current working directory** (usually the repo root). Default: **`docs/filter-type-categories.json`**. |
| **`FILTER_DESC_COLUMN`** | Default column name on each row to read for matching when a rule does not set **`sourceColumn`**. Default: **`active_skill_desc_en`**. |
| **`CATEGORY_JSON_EXPORT_DIR`** | If set (non-empty), after each successful transform the app writes **static JSON bundles** under this directory (relative to CWD unless absolute): one file per **`category`**, plus **`index.json`** listing all files and row counts. FE can import these instead of paging everything through the API. |

## JSON shape

Top level:

```json
{
  "categories": [ /* array of rules */ ]
}
```

Each rule object:

| Field | Required | Description |
|-------|----------|-------------|
| **`group`** | Yes | Logical bucket (e.g. `active_skill`, `leader_skill`, `general`). Stored in **`subcategory`**. |
| **`label`** | Yes | Human-readable name; used as **`category`** when **`key`** is omitted. |
| **`key`** | No | Stable value stored in **`category`** if you do not want to use **`label`** in the DB or API. |
| **`sourceColumn`** | No | Which row field to scan for this rule. Defaults to **`FILTER_DESC_COLUMN`** / **`active_skill_desc_en`**. Use e.g. **`leader_skill_desc_en`** for leader-skill-only rules. |
| **`patterns`** | No | Array of substrings. If **any** pattern appears in the cell text (**case-insensitive**), the rule matches. Not regular expressions. |
| **`regex`** | No | A **JavaScript** regular expression **source** string (as in `new RegExp(regex, "i")`). Matching is **case-insensitive**. Invalid strings are ignored (no crash). |
| **`matchAll`** | No | If **`true`**, the rule always matches every row. Use sparingly (e.g. a global “all types” bucket). |
| **`facets`** | No | Array of **extractors** run on the **same** column text (original casing) **after** the rule matches. Each extractor uses a **`regex`** with a capture group; the captured value is stored under **`key`** in **`facet_json`**. See below. |

A rule matches if **`matchAll`** is true, **or** any **`patterns`** entry matches, **or** **`regex`** matches. If a rule has **none** of these, it **never** matches until you add at least one.

### Facets (sub-filters: turns, multipliers, …)

Use **`facets`** when one label is not enough — for example skill text *“For **3** turns, … Charge all allies’ skills by 1 turn”*: you still match **`AS - Skill Cooldown`** (or similar) with **`patterns`** / **`regex`**, and you add extractors so the UI can filter by numeric **turns**.

Each extractor:

| Field | Required | Description |
|-------|----------|-------------|
| **`key`** | Yes | Property name in **`facet_json`**, e.g. `"turns"`. |
| **`regex`** | Yes | JS RegExp **source**; must include a **capture group** for the value you want (default group index **`group`**: `1`). |
| **`group`** | No | Capture group index (default **`1`**). |
| **`type`** | No | **`int`**, **`float`**, or **`string`** (default). Parsed values are stored as JSON numbers or strings. |

Extractors run in order; keys from multiple extractors on the **same** rule merge into one object. If several rules contribute the same **`category`** key, facet objects are **merged** (later keys overwrite earlier ones).

Example (skill line with a leading “For N turns” clause):

```json
{
  "group": "active_skill",
  "label": "AS - Skill Cooldown",
  "patterns": ["charge all allies", "charge allies' skills"],
  "facets": [
    {
      "key": "turns",
      "regex": "for\\s+(\\d+)\\s+turns?",
      "type": "int"
    }
  ]
}
```

## Static JSON export (FE)

When **`CATEGORY_JSON_EXPORT_DIR`** is set (e.g. **`exports/category-bundles`**), the transform writes:

- **`index.json`** — `{ "sourceTable", "generatedAt", "files": [ { "category", "file", "count" } ] }`
- **One file per category** (filename derived from the category string, e.g. `AS---Skill-Cooldown.json`) with shape:

```json
{
  "sourceTable": "monsters_join_skills",
  "category": "AS - Skill Cooldown",
  "subcategory": "active_skill",
  "monsters": [
    { "sourceRowId": 123, "facets": { "turns": 3 } },
    { "sourceRowId": 456, "facets": null }
  ]
}
```

**`sourceRowId`** is the same numeric id used in **`pad_categorized`** (typically **`monster_id`** when **`SOURCE_ID_COLUMN=monster_id`**). The FE can **`import`** / fetch these files at build time and filter locally (e.g. by **`facets.turns === 3`**) without loading the full monster list from the API.

## Examples

Substring rules:

```json
{
  "group": "active_skill",
  "label": "AS - Skill Cooldown",
  "patterns": ["reduce cd", "reduces skill cooldown", "lowers skill cd"]
}
```

Regex (escape backslashes in JSON):

```json
{
  "group": "active_skill",
  "label": "AS - Skill Cooldown",
  "regex": "(?:reduce|lowers)\\s+skill\\s+cd"
}
```

Leader skill text on a different column:

```json
{
  "group": "leader_skill",
  "label": "LS - No Skyfall",
  "sourceColumn": "leader_skill_desc_en",
  "patterns": ["no skyfall"]
}
```

Stable DB key with a long UI label:

```json
{
  "group": "active_skill",
  "label": "AS - Change All Orbs (Exact)",
  "key": "as_change_all_orbs_exact",
  "regex": "change (?:all )?orbs? to"
}
```

## Default row when nothing matches

If the JSON is loaded and **no** rule matches a row, the transform still writes **one** row with **`category`** = **`default`** and **`subcategory`** = **`null`**, so every source row continues to have at least one categorization record unless you change that logic in code.

## Caching

The JSON file is read once per process and cached. Restart the process after editing the file, or rely on a fresh CLI invocation for **`npm run pad -- transform`**.

## Related code

- **`src/transform/filter-type-categories.ts`** — load file, match rules, resolve category keys.
- **`src/transform/categorize-row.ts`** — **`categorizePadRows()`** orchestrates env column mode vs JSON mode.
- **`src/transform/transform.service.ts`** — bulk delete for the source table label, then insert **`pad_categorized`** rows; optional **`category-json-export.ts`** bundle write.

## API note

**`GET /pad-categorized/by-source-row`** returns an **array** of `pad_categorized` rows when multiple categories match the same **`sourceRowId`**.
