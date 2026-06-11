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

## Deploy to Oracle Cloud (Terraform + Makefile)

Infrastructure is defined in **`iac/`** (Terraform). OCI API key: **`key/api_key_name.pem`**. VM SSH key is generated to **`key/vm_ssh.pem`** on first `terraform apply`.

Makefiles live in **`iac/`**: `Makefile` (Terraform) and `deploy.mk` (sync app to VM).

### 1. Provision Oracle VM

```bash
cd iac
cp terraform.tfvars.example terraform.tfvars
# Fill tenancy_ocid, user_ocid, fingerprint, private_key_path, app_domain

make apply
make output   # public_ip, cloudflare_dns_hint, deploy_command
```

See **`iac/README.md`** for OCIDs, Cloudflare DNS, and variables.

### 2. Deploy app

```bash
cp .env.example .env   # set ADMIN_* secrets

cd iac
make -f deploy.mk deploy-all
# or: make -f deploy.mk deploy  (ORACLE_HOST auto-read from terraform output)
```

| Command (`cd iac`) | Action |
|--------------------|--------|
| `make apply` | Create/update Oracle VM + network (Terraform) |
| `make -f deploy.mk deploy-all` | `apply` + sync app + Docker start |
| `make -f deploy.mk deploy` | Sync code + `.env`, build & start container |
| `make -f deploy.mk update` | Same as deploy (rebuild) |
| `make -f deploy.mk restart` | `docker compose restart` |
| `make -f deploy.mk logs` | Follow logs |
| `make -f deploy.mk status` | `ps` + `/health` |
| `make destroy` | Tear down Oracle resources |

Optional: `SSH_KEY=../key/vm_ssh.pem` `ORACLE_USER=opc` `ENV_FILE=../.env`

Cloud-init on the VM installs **Docker**, **Caddy** (reverse proxy → `:3000`), and opens **22/80/443**.

**Cloudflare:** `terraform output cloudflare_dns` → DNS `pst` (proxied) + `origin-pst` (grey) + deploy Worker in **`cloudflare/pst-gateway/`** (path router for multiple services under `pst.hassasin.com`).

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
