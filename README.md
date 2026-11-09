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
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
ADMIN_JWT_SECRET=...
COMMUNITY_DB_URL=https://...
```

In the UI header: **Admin login** → **Refresh community DB**. Same logic as `npm run pad -- merge`, without SSH.

After the merge, the same job fetches the latest GameWith vanish assists. Assists missing from the
baked base DB (`seed/gamewith-vanish.sqlite`) go into a delta DB (`$DATA_DIR/gamewith-vanish-delta.sqlite`,
override with `VANISH_AWOKEN_DELTA_SQLITE_PATH`). Searches read the base first and the delta only for
monsters the base lacks; delta rows the base later covers are deleted when the delta is attached.
A GameWith failure does not fail the refresh — the admin panel shows it as a warning.
CD rebuilds the base DB (`scripts/import-gamewith-vanish-db.mjs`) before each deploy.

## Android app (Capacitor)

`web/android/` is a Capacitor-wrapped build of the React UI — a native shell that
calls the deployed API directly (`VITE_API_BASE` in gitignored `web/.env.android`;
copy from `web/.env.android.example`), instead of
relative same-origin paths. Requires Android Studio (bundles the SDK) + a JDK that
your installed Gradle version supports as its own runtime — see the note in
`web/.env.android.example` if you hit a `class file major version` error.

```bash
cd web
npm run android:sync   # build web assets (prod API) + copy into the native project
npm run android:open   # opens android/ in Android Studio — Run, or Build > Build APK(s)
npm run android:apk    # sync + assembleDebug, copies APK to releases/pad-searching-tool.apk
```

**Download (debug APK):** [releases/pad-searching-tool.apk](releases/pad-searching-tool.apk)

Regenerate the committed APK after UI/native changes with `npm run android:apk` from `web/`, then commit `releases/pad-searching-tool.apk` if you want the download link to stay current.

To point the app at a different backend (e.g. local dev), edit `VITE_API_BASE` in
`web/.env.android` before `android:sync`.

### In-app updates (Android)

The Android app updates itself from this repository's **GitHub Releases**; users do not have to
sideload a new APK by hand. Every CD run publishes three assets per release:

| Asset | Used for |
|-------|----------|
| `pad-searching-tool-v1.0.N.apk` | first install, and in-app **APK updates** (in-place upgrade, data kept) |
| `web-bundle-v1.0.N.zip` | in-app **web bundle updates**: the React build is downloaded into app storage and served instead of the assets packaged in the APK — no install prompt, no restart of the native shell |
| `update.json` | manifest the app reads from `releases/latest/download/update.json` (version, SHA-256 + size of both assets, `nativeApiLevel`) |

How the app picks the channel (`web/src/lib/app-update/decide.ts`):

- release not newer than what runs → nothing;
- release `nativeApiLevel` > the level compiled into the installed APK → **APK** channel
  (Android asks to confirm the install; needs "Install unknown apps" for this app once);
- otherwise → **web bundle** channel.

**`web/native-api-level.json`** is the single source of that level for Gradle
(`BuildConfig.NATIVE_API_LEVEL`), Vite (`__NATIVE_API_LEVEL__`) and the manifest. **Bump it in the
same PR as any native-shell change** (new Capacitor plugin, Capacitor major upgrade, manifest or
Gradle change); otherwise phones would receive a web bundle that expects native code they do not
have.

Pieces: `web/android/app/src/main/java/.../AppUpdatePlugin.java` (download, SHA-256 check,
unzip with zip-slip guard, switch of Capacitor's server path, crash-loop rollback, APK install
intent), `web/src/lib/app-update/` (manifest validation, channel decision, throttling, native
calls), `web/src/hooks/useAppUpdate.ts` + `web/src/components/AppUpdateLaunch.tsx` (version chip
and dialog, Android only), `scripts/ci/write-update-manifest.mjs` (manifest). The release is
created as a draft and published only after all assets are uploaded, so `latest/download/update.json`
never points at a half-uploaded release.

Behaviour notes:

- Automatic checks run 3 s after launch and on resume, at most every 6 h; "Check for updates" in
  the dialog is immediate. "Later" hides that version until the next one.
- A downloaded bundle must call `notifyReady` on its first launch; if it does not (crash, blank
  page), the next launch restores the previous bundle or the built-in assets and the dialog
  shows a rollback notice.
- Installing a newer APK drops every downloaded bundle (the APK embeds newer assets).
- A **locally built debug APK** (`npm run android:apk`) is signed with your own debug keystore
  and reports versionCode 1, so it can take web bundle updates but **cannot install the CI APK
  over itself** (signature mismatch). Point a debug build at a test release with
  `VITE_UPDATE_MANIFEST_URL` in `web/.env.android`.

Device test checklist before relying on a release (manual, needs a phone or emulator):

1. Install CI APK v1.0.N → publish v1.0.N+1 (web-only change) → chip shows "Update", tap Update
   now → app restarts on N+1, team drafts intact, kill + relaunch still N+1.
2. Rollback: point a debug build at a draft release whose zip has a broken `index.html` → after
   the update the next launch shows the rollback notice and the previous version.
3. Android "Clear storage" → app starts on the built-in assets.
4. Bump `nativeApiLevel` on a test release → dialog offers "Download & install" → installer
   upgrades in place, data kept, bundles pruned.

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
  ADMIN_USERNAME='...' \
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

**Cloudflare:** `terraform output cloudflare_dns` → DNS for the public host (proxied) + origin host (grey) + deploy Worker in **`cloudflare/pst-gateway/`** (copy `wrangler.toml.example` → `wrangler.toml`, gitignored).

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
make dungeon-max-damage                    # recompute maxDamage of every seed JSON (offline)
make dungeon-max-hits                      # resolve the max hit of every team-build catalog entry (AppMedia guides → seeds, Kamigame fallback)
```

## Dungeon details (AppMedia)

Offline pipeline under **`dungeon-details/`** — parse dungeon floor tables from [AppMedia](https://appmedia.jp/pazudora) guide pages (no dadguide).

| Step | Command | Output |
|------|---------|--------|
| 1. Gimmick master | `make dungeon-master` or `make dungeon-master URL=<url>` | `dungeon-details/seed/gimmick-master.json` |
| 2. Parse dungeons | `make dungeon-import` or `make dungeon-import URL=<url>` | `dungeon-details/seed/dungeons/<id>.json` (includes `titleEn` and `maxDamage`, the hardest hit of the preemptive table) + SQLite |
| 3. Backfill max hit | `make dungeon-max-damage` | rewrites `maxDamage` in every seed JSON (+ SQLite) without fetching — needed once for seeds imported before the field existed |
| 4. Catalog max hits | `make dungeon-max-hits` | for every entry of `web/src/lib/team-build/dungeon-catalog.json`: finds the AppMedia guide (source URL, 降臨/ゲリラ/テクニカル index pages, WP search), imports its floor table as a seed and links it (`appmediaPostId`); guides without the table and Kamigame enemy tables are stored on the entry as `maxHit`. Options: `--dry-run`, `--only <text>`, `--limit N`, `--cache <dir>`, `--report <file>` |

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
