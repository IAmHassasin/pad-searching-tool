# PAD Searching Tool

**NestJS** + **TypeORM** reads an existing **SQLite** table, applies **filter / categorization** rules in TypeScript, and writes **`pad_categorized`** into a **working** SQLite file. The community **snapshot** stays immutable: keep it only as a downloaded / bucket artifact, **copy it once** into the container writable path (`SQLITE_PATH`), run **transform**, then optionally serve **`GET`** APIs from the same working DB.

**Recommended flow:** download snapshot → store (local or object storage) → Docker entrypoint **seeds** `SQLITE_PATH` from read-only **`SQLITE_SNAPSHOT_PATH`** (or from **`DB_DOWNLOAD_URL`** into a temp seed, then copy) → **transform** adds/updates `pad_categorized` only on the working file → **`START_HTTP=true`** keeps the process up as an API.

Legacy **merge** import (`IMPORT_MODE=merge`) still exists if you maintain a single working file and want to refresh base tables in place.

### One `.env` + unified CLI (`npm run pad`)

Copy **`.env.example` → `.env`** and edit values once. **`npm run pad -- <command>`** always loads `.env`; **`docker compose`** also uses the same file via **`env_file`**.

| Command | What it runs |
|---------|----------------|
| `npm run pad -- snapshot` | Build + **`IMPORT_MODE=download`** → **`SNAPSHOT_OUTPUT_PATH`** only (immutable snapshot). |
| `npm run pad -- merge` | Build + **`import-external-db`** (`IMPORT_MODE` from `.env`: `merge` or `replace`). |
| `npm run pad -- transform` | Build + categorize only (`START_HTTP` forced **off**). |
| `npm run pad -- serve` | Build + **`START_HTTP` on** (`RUN_TRANSFORM` still from `.env`). |
| `npm run pad -- update` | Build + **`merge`** import script, then categorize (same as old `db:update`). |
| `npm run pad -- compose up --build` | Runs **`docker compose`** with forwarded args (`up -d`, etc.). |

`npm run pad -- help` works even before you create `.env`.

Operational flow (same idea as **PAD fansite architecture**, §5 — import dump → run tagging/transform pipeline):

1. **`npm run pad -- snapshot`** — download GitHub/community SQLite **only** to **`SNAPSHOT_OUTPUT_PATH`** (set **`COMMUNITY_DB_URL`** in `.env`).
2. **`npm run pad -- merge`** — merge or replace **`SQLITE_PATH`** per **`IMPORT_MODE`**.
3. **`npm run pad -- transform`** — rebuild **`pad_categorized`**.
4. **`npm run pad -- update`** — merge + transform in sequence.
5. **`npm run pad -- compose up --build`** — stack Docker with variables from `.env` (compose overrides **`SQLITE_PATH`** → **`/data/pad.db`**, **`START_HTTP`/`RUN_TRANSFORM`** → **`true`**, **`HTTP_HOST`** → **`0.0.0.0`** so the API is reachable from the host port mapping).
6. Optionally **`npm run pad -- serve`** or container defaults with **`START_HTTP=true`** for the HTTP APIs.

## How it works (transform + optional API)

1. **Docker entrypoint** (`docker-entrypoint.sh`): if **`SQLITE_SNAPSHOT_PATH`** or **`DB_DOWNLOAD_URL`** is set, the seed file is copied into **`SQLITE_PATH`** only when the working file is missing or **`FORCE_SQLITE_INIT=true`**. Transform and HTTP never write to the mounted snapshot itself.
2. Nest runs **`TransformService`** when **`RUN_TRANSFORM`** is not `false`. With **`START_HTTP=false`**, the app uses **`NestFactory.createApplicationContext`** (no listener) and exits when done; with **`START_HTTP=true`**, it runs transform (if enabled) then **`listen`** (Express via `@nestjs/platform-express`).
3. TypeORM opens **`SQLITE_PATH`** **read/write**, ensures `pad_categorized` exists (`synchronize` unless disabled), deletes prior rows for the configured **`SOURCE_TABLE`**, then rebuilds them.
4. Categorization lives in `src/transform/categorize-row.ts` (and optional env column mapping below). Read APIs: **`/health`**, **`/source-records`**, **`/awoken-skills`**, **`/pad-categorized`**, **`/pad-categorized/by-source-row`**.

**Docker và DB:** Trong container, TypeORM mở **`SQLITE_PATH`** (vd `/data/pad.db` trên volume sau khi entrypoint **`cp`** từ seed). HTTP bind **`HTTP_HOST`** (mặc định **`0.0.0.0`**) để cổng publish hoạt động.

**ORM:** **`PadCategorized`** dùng entity + repository (ORM đầy đủ). **`SOURCE_QUERY`** / đọc join là SQL động từ env — không map được sang một `@Entity()` cố định; `DataSource.query()` vẫn đi qua **cùng connection TypeORM / better-sqlite3**, chỉ là SQL text thay vì QueryBuilder/Repository.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SOURCE_TABLE` | **Yes** | Name of the existing SQLite table to scan (e.g. `pads`). |
| `SOURCE_QUERY` | No | SQL `SELECT` used as the source instead of `SOURCE_TABLE` (for read-only DBs where you cannot create joined tables). |
| `SQLITE_PATH` | No | **Local / CLI**: working DB path (`.env`; default `./pad.db`). **`docker-compose.yml`** sets **`SQLITE_PATH=/data/pad.db`** on the **app** service so the container path overrides your host value. |
| `SOURCE_ID_COLUMN` | No | **`SOURCE_QUERY`**: required — numeric column with **no NULLs** (dadguide `monster_no_na` has many NULLs → duplicates; use **`monster_id`**). **`SOURCE_TABLE`** mode: optional — SQLite **`rowid`** if omitted. |
| `CATEGORY_FROM_COLUMN` | No | If set, `category` is taken from this column’s value. |
| `SUBCATEGORY_FROM_COLUMN` | No | Optional; maps to `subcategory` when `CATEGORY_FROM_COLUMN` is set. |
| `SQLITE_SNAPSHOT_PATH` | No | **Immutable** SQLite used only as seed: copied into **`SQLITE_PATH`** on first init (or when **`FORCE_SQLITE_INIT=true`**). Prefer **`:ro`** bind mounts. |
| `FORCE_SQLITE_INIT` | No | If `true`, overwrite **`SQLITE_PATH`** from the snapshot / download seed on every container start (**derived** rows are reset unless persisted elsewhere). |
| `DB_DOWNLOAD_URL` | No | URL to fetch a **seed** file; entrypoint downloads to **`$DATA_DIR/community-snapshot.sqlite`**, then **copies** to **`SQLITE_PATH`** using the same init rules as `SQLITE_SNAPSHOT_PATH`. |
| `RUN_TRANSFORM` | No | Default `true`. Set to `false` to skip categorize (API-only against an already-built working DB). |
| `START_HTTP` | No | Default `false` in local `main.ts` usage; Docker image sets **`true`** so the container stays up and serves HTTP (override with `false` for one-shot jobs). |
| `HTTP_PORT` | No | Listen port when `START_HTTP=true`. Default `3000`. |
| `HTTP_HOST` | No | Bind address. Default **`0.0.0.0`** (needed inside Docker so published ports work). |
| `DATA_DIR` | No | Ensured to exist. Default `/data` (entrypoint). |
| `TYPEORM_SYNC` | No | Set to `false` to stop TypeORM from altering schema (create migrations yourself). Default: sync **on** (creates/updates `pad_categorized` only for registered entities). |
| `TYPEORM_LOGGING` | No | Set to `true` for SQL logs. |
| `SOURCE_COLUMN_WHITELIST` | No | Comma-separated **result** column names to keep after load (smaller JSON / categorize input). Internal `__source_pk` / `__rowid` are always kept. Omit to keep all columns. |
| `INSERT_BATCH` | No | Batch size for inserts (default `500`). |
| `SUMMARY_MAX_FIELDS` | No | Max source fields stored in `summary_json` (default `8`). |
| `AWOKEN_SKILLS_TABLE` | No | SQLite table for **`GET /awoken-skills`**. Default **`awoken_skills`**. |

### Import community DB (called by **`npm run pad -- merge`** / **`snapshot`**)

| Variable | Required | Description |
|----------|----------|-------------|
| `COMMUNITY_DB_URL` | One of the URL vars | Primary URL for the community `.sqlite` file. |
| `EXTERNAL_DB_URL` | alt. | Same as above (second choice if `COMMUNITY_DB_URL` is empty). |
| `DB_DOWNLOAD_URL` | alt. | Same as above (third choice; also used by Docker entrypoint for raw download). |
| `SQLITE_PATH` | No | Working database file to update. Default: `./pad.db`. |
| `IMPORT_MODE` | No | `merge` (default): merge into **`SQLITE_PATH`**. `replace`: replace **`SQLITE_PATH`** with the download. **`download`**: save the file **only** to **`SNAPSHOT_OUTPUT_PATH`** (or **`SQLITE_SNAPSHOT_PATH`**) — no merge; use for golden snapshots / upload to a bucket. |
| `SNAPSHOT_OUTPUT_PATH` | For `download` | Output path for **`IMPORT_MODE=download`**. |
| `IMPORT_KEEP_LOCAL_TABLES` | No | Comma-separated table names that are **your** derived layer and must not be replaced from the community file. Default: `pad_categorized,skill_tag,skill_tag_manual` (aligns with derived `skill_tag` / overrides in the architecture note). |
| `IMPORT_SKIP_TABLES` | No | Upstream table names to skip when importing (optional). |
| `IMPORT_BACKUP` | No | Set to `true` to copy `SQLITE_PATH` to `SQLITE_PATH.bak-<timestamp>` before import. |

## Customize categorization

- **Env-driven:** set `CATEGORY_FROM_COLUMN` / `SUBCATEGORY_FROM_COLUMN` to copy values from the source table.
- **Code-driven:** edit `src/transform/categorize-row.ts` (`categorizePadRow`) for real PAD rules (regex, ranges, reference tables, etc.).

When your DB is read-only and you cannot create a merged table, use `SOURCE_QUERY`:

```bash
$env:SOURCE_TABLE = "monsters_active_joined"
$env:SOURCE_ID_COLUMN = "monster_id"
$env:SOURCE_QUERY = "SELECT m.*, a.desc_en AS active_skill_desc_en, a.tags AS active_skill_tags, l.desc_en AS leader_skill_desc_en, l.tags AS leader_skill_tags FROM monsters m LEFT JOIN active_skills a ON m.active_skill_id = a.active_skill_id LEFT JOIN leader_skills l ON m.leader_skill_id = l.leader_skill_id"
npm run pad -- transform
```

## Local development

```bash
npm install
cp .env.example .env   # Windows: copy .env.example .env
# Edit .env: SQLITE_PATH, SOURCE_TABLE, COMMUNITY_DB_URL, …
npm run start:dev       # loads .env via dotenv-cli
npm run start           # build → transform → HTTP (RUN_TRANSFORM + START_HTTP forced on)
# Jobs (load .env in scripts/pad.mjs — no duplicate env vars in the shell):
npm run pad -- transform
```

### Web UI (3-panel)

Vite + React app in **`web/`** — see **`docs/ui-three-panel-design.md`**.

1. Run transform so **`CATEGORY_JSON_EXPORT_DIR`** has bundles (`exports/category-bundles`).
2. Start API: `npm run pad -- serve` (port **3000**).
3. In another terminal: `npm install --prefix web` then `npm run dev:web` → **http://localhost:5173**

The UI loads all monsters once (`GET /source-records`), caches **`GET /category-bundles/index`**, and fetches each category JSON on demand (TanStack Query, infinite stale time). Filtering is client-side (left monster filters **AND** right skill/category filters).

| Endpoint | Purpose |
|----------|---------|
| `GET /category-bundles/index` | List of category JSON files |
| `GET /category-bundles/file?name=…` | One category’s `sourceRowId` list |
| `GET /filter-categories` | Full filter manifest (optional) |
| `GET /source-records` | Monster rows (paginated; FE loads all pages) |

Production: set **`VITE_API_BASE`** in `web/.env` to your API origin (Cloudflare can cache the bundle URLs).

Download and merge a community database (values in `.env`), then categorize:

```bash
npm run pad -- merge
npm run pad -- transform
# or:
npm run pad -- update
```

Download **only** an immutable snapshot path from `.env` (`COMMUNITY_DB_URL`, `SNAPSHOT_OUTPUT_PATH`):

```bash
npm run pad -- snapshot
```

To create a tiny sample DB (optional):

```bash
node scripts/create-test-db.mjs
```

Then set **`SQLITE_PATH`** / **`SOURCE_TABLE`** in `.env` to `test.db` / `pads` and **`npm run pad -- transform`**.

## Docker (seed → transform → API + web UI)

The image **builds the Vite frontend** (`web/`) into **`/app/public`** and serves it on the same port as the API (**`HTTP_PORT`**, default `3000`). Open **`http://localhost:3000`** for the 3-panel UI; API paths (`/health`, `/source-records`, `/category-bundles`, …) are unchanged.

Defaults: **`RUN_TRANSFORM=true`** and **`START_HTTP=true`** — seed working DB (if needed), categorize, then serve HTTP. For a **cron-style** one-shot (transform only, exit), set **`START_HTTP=false`**.

```bash
docker build -t pad-searching-tool .
docker run --rm -p 3000:3000 \
  -e SOURCE_TABLE="your_table" \
  -e DB_DOWNLOAD_URL="https://example.com/your-database.sqlite" \
  -v pad-data:/data \
  pad-searching-tool
```

**Immutable snapshot mount** (community file never written; derived data on a named volume):

```bash
docker run --rm -p 3000:3000 \
  -e SOURCE_TABLE="your_table" \
  -e SQLITE_SNAPSHOT_PATH=/seed/pad.sqlite \
  -v "${PWD}/local/community-pad.sqlite:/seed/pad.sqlite:ro" \
  -v pad-data:/data \
  pad-searching-tool
```

Compose (same `.env` as CLI):

```bash
npm run pad -- compose up --build
```

Ensure `.env` has **`COMMUNITY_DB_URL`** / **`DB_DOWNLOAD_URL`** and related flags, or mount a snapshot and set **`SQLITE_SNAPSHOT_PATH`**.

## Oracle Cloud Infrastructure (Free Tier)

Same overall idea as before: use an **Always Free** VM (for example **Ampere A1**), install **Docker**, store the **immutable** snapshot on object storage or disk, mount it read-only into the container as **`SQLITE_SNAPSHOT_PATH`** (or rely on **`DB_DOWNLOAD_URL`**), and use a **writable** volume for **`/data`** so `pad_categorized` persists.

1. Create a **VM.Standard.A1.Flex** (or eligible shape) in your **home region**.
2. Install Docker (see Oracle/Linux docs for your image).
3. **Ingress:** allow **SSH (22)**. If you expose the API, allow **`HTTP_PORT`** (default `3000`) or put a reverse proxy / load balancer in front.
4. Publish the snapshot via Object Storage + pre-authenticated URL (**`DB_DOWNLOAD_URL`**) or **`scp`** + bind mount **`SQLITE_SNAPSHOT_PATH`**.
5. Run `docker compose up` or `docker run` with `SOURCE_TABLE` set and either a seed URL/path or an existing working volume.

## Security notes

- The job **writes** to **`SQLITE_PATH`** only (new table + deletes old index rows for that source table). Keep **`SQLITE_SNAPSHOT_PATH`** read-only on the host/bucket copy; use backups for the **working** DB volume.
- `SOURCE_TABLE` and `SOURCE_ID_COLUMN` are validated to reduce SQL injection risk in dynamic SQL.
- For production, set `TYPEORM_SYNC=false` and manage schema with [TypeORM migrations](https://typeorm.io/migrations).

## License

Specify your license here.
