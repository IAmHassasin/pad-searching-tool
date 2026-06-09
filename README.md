# PAD Searching Tool

Search PAD monsters from a **community SQLite** database (dadguide) using **regex pattern filters** on active / leader skill text. **NestJS** + **TypeORM** + **React** UI.

**Production:** one **Docker** container serves API + web UI on port **3000**.

## Quick start (Docker)

```bash
cp .env.example .env   # optional: edit ADMIN_* before exposing the app
docker compose -f docker-compose.yml -f docker-compose.cloud.yml up -d --build
```

Open **http://localhost:3000**

- First start: entrypoint downloads/copies community DB into writable volume `/data/pad.db` (if missing).
- UI and API share the same origin — no separate Vite dev server in production.

### Local compose with seed file

If you have `seed/dadguide.sqlite` on the host, use default `docker-compose.yml` only (bind-mount seed). For cloud / URL-only seed, use **`docker-compose.cloud.yml`** (no host seed mount).

## How search works

1. **`exports/patterns/patterns_group.json`** — filter labels in the UI (active / leader categories).
2. **`exports/patterns/pad_generated_patterns.json`** — regex patterns per tag.
3. User selects tags → **`GET /monsters/search`** builds SQLite `regexp()` clauses on `active_skill_desc_en` / `leader_skill_desc_en`.
4. Monster stat filters (rarity, attributes, HP/ATK/RCV, id/name) are applied in the same SQL query.

Patterns ship inside the Docker image (`exports/patterns/`). Rebuild image after editing them.

## Web UI

Three panels: monster filters (left), results (center), skill pattern filters (right).

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness |
| `GET /patterns/groups` | Pattern filter manifest for UI |
| `GET /monsters/search` | Dynamic search (`activeTags`, `leaderTags`, `patternMatch`, monster filters) |
| `POST /admin/login` | Superadmin login |
| `POST /admin/refresh-db` | Download + merge community DB (auth required) |

### Admin: refresh community DB

Set in `.env` (VM secrets — do not commit):

```env
ADMIN_USERNAME=superadmin
ADMIN_PASSWORD=...
ADMIN_JWT_SECRET=...
COMMUNITY_DB_URL=https://...
```

In the UI header: **Admin login** → **Refresh community DB**. Same logic as `npm run pad -- merge`, without SSH.

## Deploy to Oracle Cloud (Makefile)

From your machine (Git Bash / WSL / Linux), with SSH access to the VM:

```bash
make deploy ORACLE_HOST=<vm-ip> \
  COMMUNITY_DB_URL='https://.../dadguide.sqlite' \
  ADMIN_PASSWORD='...' \
  ADMIN_JWT_SECRET='...'
```

| Command | Action |
|---------|--------|
| `make deploy` | Sync code + `.env`, build & start container |
| `make update` | Same as deploy (rebuild) |
| `make restart` | `docker compose restart` |
| `make logs` | Follow logs |
| `make status` | `ps` + `/health` |
| `make help` | Usage |

Optional: `SSH_KEY=~/.ssh/key.pem` `ORACLE_USER=opc` `ENV_FILE=.env`

The Makefile uploads your local `.env`, patches secrets from CLI args, and uses `docker-compose.cloud.yml` (URL seed, no host `.sqlite` mount).

**VM prerequisites (once):** Docker + Docker Compose plugin. Open ports **22** (SSH) and **3000** (HTTP).

## CLI (`npm run pad`)

Copy **`.env.example` → `.env`**. Maintenance jobs (optional if you use Docker + admin UI):

| Command | What it runs |
|---------|----------------|
| `npm run pad -- merge` | Download community DB → merge into `SQLITE_PATH` |
| `npm run pad -- update` | merge + transform (legacy categorize) |
| `npm run pad -- serve` | Local API on port 3000 (`START_HTTP=true`) |
| `npm run pad -- compose up --build` | Docker Compose |

`npm run pad -- help` for full list.

### Local frontend dev (optional)

Only when editing `web/` with hot reload:

```bash
npm run pad -- serve          # API :3000
npm run dev:web               # Vite :5173 (proxies /patterns, /monsters, /admin, …)
```

## Docker internals

1. **`docker-entrypoint.sh`** — seed `SQLITE_PATH` from `COMMUNITY_DB_URL` / `DB_DOWNLOAD_URL` when working DB is missing (or `FORCE_SQLITE_INIT=true`).
2. **NestJS** — `RUN_TRANSFORM` (default `true`) optionally rebuilds `pad_categorized` on start; **not required** for pattern search. Set `RUN_TRANSFORM=false` for faster boots.
3. **Volume** `dadguide_working_sqlite` → `/data` persists the working DB across restarts.

```bash
# URL-only (cloud)
docker compose -f docker-compose.yml -f docker-compose.cloud.yml up -d --build

# With local seed file
docker compose up -d --build
```

## Key environment variables

| Variable | Description |
|----------|-------------|
| `COMMUNITY_DB_URL` | Community `.sqlite` download URL |
| `SOURCE_QUERY` | SQL join for monsters + skills (see `.env.example`) |
| `SOURCE_ID_COLUMN` | PK column, e.g. `monster_id` |
| `SOURCE_COLUMN_WHITELIST` | Columns returned to API |
| `PATTERNS_GROUP_PATH` | UI filter groups (default `exports/patterns/patterns_group.json`) |
| `PATTERNS_CATALOG_PATH` | Regex catalog (default `exports/patterns/pad_generated_patterns.json`) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_JWT_SECRET` | Superadmin + refresh API |
| `HTTP_PUBLISH_PORT` | Host port mapped to container (default `3000`) |
| `RUN_TRANSFORM` | `false` skips legacy categorize on startup |
| `IMPORT_KEEP_LOCAL_TABLES` | Tables preserved on merge refresh (default includes `pad_categorized`) |

See **`.env.example`** for the full list.

## Security

- Do **not** commit `.env` — use VM env file or pass secrets via `make deploy`.
- `SOURCE_TABLE` / `SOURCE_ID_COLUMN` are validated; `SOURCE_QUERY` is trusted config from env.
- Keep community snapshot read-only; working DB lives on Docker volume `/data`.

## License

Specify your license here.
