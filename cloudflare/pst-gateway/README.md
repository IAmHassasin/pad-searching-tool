# Cloudflare Worker gateway

Edge router cho **một subdomain public**, nhiều backend phía sau.

```
Browser → https://<PUBLIC_HOST>/...
              ↓ Cloudflare (orange, SSL)
         pst-gateway Worker  (path router)
              ↓ fetch grey-cloud / external origins only
    ┌─────────┴──────────┬─────────────────┐
    ↓                    ↓                 ↓
origin host          other origins     OCI bucket URL
(PAD Docker)         (future)          (future /cdn)
```

**Không** fetch the public host hay IP trực tiếp từ Worker → tránh error **1003**.

Copy `wrangler.toml.example` → `wrangler.toml` (gitignored) and fill `PUBLIC_HOST`, `ORIGIN_PAD`, and the Worker route.

## DNS

Lấy IP origin từ Terraform (`cd iac && terraform output public_ip`) — **không** commit IP VM hay hostname thật vào git.

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | public host | `<ORACLE_PUBLIC_IP>` | **Proxied** (orange) |
| A | origin host | `<ORACLE_PUBLIC_IP>` | **DNS only** (grey) |

- Public host — user-facing, Worker route
- Origin host — Worker → VM origin (PAD app qua Caddy :80)

SSL/TLS: **Flexible** hoặc **Full** (origin HTTP only).

## Deploy Worker

```bash
cd cloudflare/pst-gateway
cp wrangler.toml.example wrangler.toml   # fill real hostnames
npm install
npx wrangler login
npm run deploy
```

Route đã khai báo trong `wrangler.toml`. Sau deploy: Workers → `pst-gateway` → Routes.

## Thêm service mới

1. **DNS** — tạo grey-cloud origin (hoặc dùng OCI bucket URL)
2. **`wrangler.toml`** — thêm `ORIGIN_WIKI = "http://origin-wiki.example.com"`
3. **`src/routes.js`** — uncomment / thêm block `prefix: '/wiki'`
4. **`npm run deploy`**

Ví dụ static bucket (giống riftpool):

```js
{
  name: 'docs',
  prefix: '/docs',
  origin: env.ORIGIN_DOCS, // https://objectstorage.../bucket/o
  spaFallback: true,
  mapPath: (path) =>
    path === '/docs' || path === '/docs/' ? '/docs/index.html' : path,
},
```

## Local dev

```bash
npm run dev
# http://localhost:8787
```

## Cache (khuyến nghị)

Cloudflare → Cache Rules → **Bypass** cho:

- `/monsters/*`
- `/admin/*`
- `/patterns/*`
- `/health`

## Verify (thứ tự deploy — tránh 502 tạm)

```bash
# 1. VM + Docker chạy
curl -s http://<ORIGIN_HOST>/health    # → {"ok":true}

# 2. Sau đó mới deploy Worker
curl -s https://<PUBLIC_HOST>/health   # → {"ok":true}
```

**502 Bad gateway** thường do: Docker đang build/restart, origin DNS grey chưa có, hoặc Worker deploy trước khi VM sẵn sàng. Đợi `deploy.cmd deploy` xong + health OK rồi `npm run deploy` Worker.
