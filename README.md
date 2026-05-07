# PAD Searching Tool

**NestJS** + **TypeORM** job that reads an existing **SQLite** table, applies **filter / categorization** rules in TypeScript, and writes a derived table **`pad_categorized`** in the **same database file** for easier querying. There is **no HTTP API** in this stage (the process exits when the transform finishes).

The database file is **external**: use **`npm run import:db`** (community URL in env) to merge a dump into your working SQLite file while keeping **derived** tables (see below), or rely on `docker-entrypoint.sh` / bind-mounts when deploying.

Operational flow (same idea as **PAD fansite architecture**, §5 — import dump → run tagging/transform pipeline):

1. **`npm run import:db`** — download community SQLite from **`COMMUNITY_DB_URL`** / **`EXTERNAL_DB_URL`** / **`DB_DOWNLOAD_URL`** and merge into **`SQLITE_PATH`** (`IMPORT_MODE=merge` by default).
2. **`npm run transform`** — rebuild **`pad_categorized`** (and later `skill_tag`, etc.) from the updated base tables.
3. Optional: **`npm run db:update`** — one `npm run build`, then import, then transform (same as `import:db` + `start`, without compiling twice).

## How it works (transform)

1. Optional: for Docker-only download without merge, the entrypoint can still fetch a file to `SQLITE_PATH` before `npm start` (see `docker-entrypoint.sh`); for day-to-day updates, prefer **`import:db`** locally or in CI.
2. Nest bootstraps a **standalone application context** (no web server) and runs `TransformService`.
3. TypeORM opens the DB as **read/write**, ensures the `pad_categorized` entity exists (`synchronize`, unless you disable it), **deletes** prior rows for the configured `SOURCE_TABLE`, then **rebuilds** that index from your source table.
4. Categorization logic lives in `src/transform/categorize-row.ts` (and optional column mapping via env — see below).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SOURCE_TABLE` | **Yes** | Name of the existing SQLite table to scan (e.g. `pads`). |
| `SQLITE_PATH` | No | Path to the SQLite file. Default: `./pad.db` in code; `/data/pad.db` in Docker. |
| `SOURCE_ID_COLUMN` | No | Integer primary key column. If omitted, **SQLite `rowid`** is used (`__rowid`). |
| `CATEGORY_FROM_COLUMN` | No | If set, `category` is taken from this column’s value. |
| `SUBCATEGORY_FROM_COLUMN` | No | Optional; maps to `subcategory` when `CATEGORY_FROM_COLUMN` is set. |
| `DB_DOWNLOAD_URL` | No | URL to download the DB before the job runs (same as before). |
| `DATA_DIR` | No | Ensured to exist. Default `/data` (entrypoint). |
| `TYPEORM_SYNC` | No | Set to `false` to stop TypeORM from altering schema (create migrations yourself). Default: sync **on** (creates/updates `pad_categorized` only for registered entities). |
| `TYPEORM_LOGGING` | No | Set to `true` for SQL logs. |
| `INSERT_BATCH` | No | Batch size for inserts (default `500`). |
| `SUMMARY_MAX_FIELDS` | No | Max source fields stored in `summary_json` (default `8`). |

### Import community DB (`import:db`)

| Variable | Required | Description |
|----------|----------|-------------|
| `COMMUNITY_DB_URL` | One of the URL vars | Primary URL for the community `.sqlite` file. |
| `EXTERNAL_DB_URL` | alt. | Same as above (second choice if `COMMUNITY_DB_URL` is empty). |
| `DB_DOWNLOAD_URL` | alt. | Same as above (third choice; also used by Docker entrypoint for raw download). |
| `SQLITE_PATH` | No | Working database file to update. Default: `./pad.db`. |
| `IMPORT_MODE` | No | `merge` (default): for each table in the dump, replace data in the working DB; **do not** overwrite tables whose names are listed in `IMPORT_KEEP_LOCAL_TABLES`. `replace`: replace the whole file with the downloaded file (use with care). |
| `IMPORT_KEEP_LOCAL_TABLES` | No | Comma-separated table names that are **your** derived layer and must not be replaced from the community file. Default: `pad_categorized,skill_tag,skill_tag_manual` (aligns with derived `skill_tag` / overrides in the architecture note). |
| `IMPORT_SKIP_TABLES` | No | Upstream table names to skip when importing (optional). |
| `IMPORT_BACKUP` | No | Set to `true` to copy `SQLITE_PATH` to `SQLITE_PATH.bak-<timestamp>` before import. |

## Customize categorization

- **Env-driven:** set `CATEGORY_FROM_COLUMN` / `SUBCATEGORY_FROM_COLUMN` to copy values from the source table.
- **Code-driven:** edit `src/transform/categorize-row.ts` (`categorizePadRow`) for real PAD rules (regex, ranges, reference tables, etc.).

## Local development

```bash
npm install
# Windows PowerShell example:
$env:SQLITE_PATH = "D:\path\to\file.db"
$env:SOURCE_TABLE = "your_table_name"
npm run start:dev
# or one-off:
npm run transform
```

Download and merge a community database, then rebuild derived rows:

```bash
$env:COMMUNITY_DB_URL = "https://example.com/pad-community.sqlite"
$env:SQLITE_PATH = ".\pad.db"
npm run import:db
# then:
npm run transform
# or in one go:
npm run db:update
```

To create a tiny sample DB and run the job (optional):

```bash
node scripts/create-test-db.mjs
$env:SQLITE_PATH = "test.db"
$env:SOURCE_TABLE = "pads"
npm run transform
```

## Docker (one-shot job)

The container **starts, runs the transform, and exits** (suitable for `cron` on a VM or a manual `docker run`).

```bash
docker build -t pad-searching-tool .
docker run --rm \
  -e SOURCE_TABLE="your_table" \
  -e DB_DOWNLOAD_URL="https://example.com/your-database.sqlite" \
  pad-searching-tool
```

With a local file (read/write so the new table can be written):

```bash
docker run --rm \
  -e SOURCE_TABLE="your_table" \
  -v "${PWD}/pad.db:/data/pad.db:rw" \
  pad-searching-tool
```

Compose: edit `docker-compose.yml` (`SOURCE_TABLE`, volumes, optional `DB_DOWNLOAD_URL`), then:

```bash
docker compose run --rm app
```

(`docker compose up` is less ideal because the service exits when done.)

## Oracle Cloud Infrastructure (Free Tier)

Same overall idea as before: use an **Always Free** VM (for example **Ampere A1**), install **Docker**, copy or download the SQLite file, then run the container on a schedule or by hand. **You do not need to open an HTTP port** for this batch job (only **SSH** for admin unless you add an API later).

1. Create a **VM.Standard.A1.Flex** (or eligible shape) in your **home region**.
2. Install Docker (see previous revisions of this README or Oracle/Linux docs for your image).
3. **Ingress:** allow **SSH (22)** from your IP. No application port required for the transform-only workload.
4. Copy the DB (`scp`) or set `DB_DOWNLOAD_URL` to Object Storage / HTTPS.
5. Run `docker run` or `docker compose run` with `SOURCE_TABLE` set.

## Security notes

- The job **writes** to the SQLite file (new table + deletes old index rows for that source table). Use backups.
- `SOURCE_TABLE` and `SOURCE_ID_COLUMN` are validated to reduce SQL injection risk in dynamic SQL.
- For production, set `TYPEORM_SYNC=false` and manage schema with [TypeORM migrations](https://typeorm.io/migrations).

## License

Specify your license here.
