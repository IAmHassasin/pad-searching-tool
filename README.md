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

### 3. Cloud: cập nhật / deploy / restart Docker

Chạy từ **`iac/`** sau khi đã `make apply`. VM dùng **`docker compose -f docker-compose.yml -f docker-compose.cloud.yml`** (DB từ `COMMUNITY_DB_URL`, volume `dadguide_working_sqlite` giữ `/data/pad.db`).

**Yêu cầu:** `../.env` (secrets), SSH key `key/vm_ssh.pem`, `ORACLE_HOST` lấy tự Terraform output (hoặc override).

| Lệnh (`cd iac`) | Khi nào dùng |
|-----------------|--------------|
| `make apply` | Provision / cập nhật VM + network (Terraform) |
| `make -f deploy.mk deploy-all` | `terraform apply` + deploy (infra + app) |
| `make -f deploy.mk deploy` | **Deploy đầy đủ:** sync code + `.env` lên VM → `docker compose up -d --build` |
| `make -f deploy.mk update` | Giống `deploy` (alias) — sau khi sửa code / patterns / UI |
| `make -f deploy.mk restart` | **Chỉ restart** container, không rebuild image |
| `make -f deploy.mk logs` | Theo dõi log (`--tail=200 -f`) |
| `make -f deploy.mk status` | `docker compose ps` + `curl /health` trên VM |
| `make -f deploy.mk ssh` | Shell SSH vào VM |
| `make destroy` | Xóa hạ tầng Oracle (VM + IP) |

**Windows (CMD / PowerShell):**

```cmd
cd iac
deploy.cmd deploy
deploy.cmd update
deploy.cmd restart
deploy.cmd logs
deploy.cmd status
deploy.cmd ssh
```

**Override (tùy chọn):**

```bash
make -f deploy.mk deploy ORACLE_HOST=1.2.3.4 SSH_KEY=../key/vm_ssh.pem ORACLE_USER=opc
make -f deploy.mk deploy \
  COMMUNITY_DB_URL='https://...' \
  ADMIN_USERNAME=superadmin \
  ADMIN_PASSWORD='...' \
  ADMIN_JWT_SECRET='...'
```

Secrets trong lệnh `deploy` chỉ **patch** các biến đó trên `.env` VM; file `.env` gốc vẫn được upload từ `../.env`.

**Trên VM (SSH thủ công):**

```bash
cd ~/pad-searching-tool
sudo docker compose -f docker-compose.yml -f docker-compose.cloud.yml ps
sudo docker compose -f docker-compose.yml -f docker-compose.cloud.yml logs -f --tail=200
sudo docker compose -f docker-compose.yml -f docker-compose.cloud.yml restart
sudo docker compose -f docker-compose.yml -f docker-compose.cloud.yml up -d --build   # rebuild sau khi đã sync code
sudo docker compose -f docker-compose.yml -f docker-compose.cloud.yml down            # dừng (giữ volume)
sudo docker compose -f docker-compose.yml -f docker-compose.cloud.yml down -v       # dừng + xóa volume DB
```

**Cập nhật community DB (không redeploy code):**

- UI production: **Admin login** → **Refresh community DB** (cần `ADMIN_*` + `COMMUNITY_DB_URL` trong `.env` VM).
- Hoặc trên máy local: `npm run pad -- merge` rồi deploy lại — thường không cần nếu dùng Admin refresh.

**Ép tải lại DB từ URL (bỏ working DB cũ trên volume):**

```bash
# Trên VM, một lần:
cd ~/pad-searching-tool
sudo docker compose -f docker-compose.yml -f docker-compose.cloud.yml down
sudo docker volume rm pad-searching-tool_dadguide_working_sqlite   # tên volume có thể khác — xem `docker volume ls`
sudo docker compose -f docker-compose.yml -f docker-compose.cloud.yml up -d --build
# Hoặc set FORCE_SQLITE_INIT=true trong .env rồi restart container
```

Optional overrides: `SSH_KEY=../key/vm_ssh.pem` `ORACLE_USER=opc` `ENV_FILE=../.env`

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
| `npm run pad -- dungeon:gimmick-master <url…>` | Merge AppMedia gimmick master |
| `npm run pad -- dungeon:import <url\|id>` | Parse one dungeon guide → JSON |

`npm run pad -- help` for full list.

**Shorter Makefile aliases** (same jobs):

```bash
make dungeon-master                        # batch URLs in dungeon-details/seed/dungeon-urls.txt
make dungeon-master URL=https://appmedia.jp/pazudora/79970458
make dungeon-import                        # parse all URLs in dungeon-urls.txt
make dungeon-import URL=79970458           # parse one dungeon
```

## Dungeon details (AppMedia)

Offline pipeline under **`dungeon-details/`** — parse dungeon floor tables from [AppMedia](https://appmedia.jp/pazudora) guide pages (no dadguide).

| Step | Command | Output |
|------|---------|--------|
| 1. Gimmick master | `make dungeon-master` or `make dungeon-master URL=<url>` | `dungeon-details/seed/gimmick-master.json` |
| 2. Parse dungeons | `make dungeon-import` or `make dungeon-import URL=<url>` | `dungeon-details/seed/dungeons/<id>.json` (includes `titleEn`) + SQLite |

- Edit **`dungeon-details/seed/dungeon-urls.txt`** — one AppMedia URL/postId per line (used by both `dungeon-master` and `dungeon-import`).
- Edit **`dungeon-details/seed/gimmick-phrase-aliases.json`** — extra Japanese phrases → gimmick id (improves effect matching).
- First import on a new page auto-creates master from that page’s 対策必須/要注意 table if master is missing.

**Deploy / URL (local Docker):** after `make dungeon-import` and `make up`:

- **http://localhost:3000/dungeon-details** — UI (dungeon list)
- **http://localhost:3000/dungeon-details/79970458** — UI (floor table)
- **http://localhost:3000/api/dungeon-details** — JSON API (not for browser navigation)

English text uses a PAD glossary at `dungeon-details/seed/translations/en.json` (not a generic MT library). Hover / `title` shows Japanese source where useful. Extend `phrases` and `gimmicks` as you parse more dungeons.

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
