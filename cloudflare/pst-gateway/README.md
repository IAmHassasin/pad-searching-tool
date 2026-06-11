# pst.hassasin.com — Cloudflare Worker gateway

Edge router cho **một subdomain public**, nhiều backend phía sau.

```
Browser → https://pst.hassasin.com/wiki/...
              ↓ Cloudflare (orange, SSL)
         pst-gateway Worker  (path router)
              ↓ fetch grey-cloud / external origins only
    ┌─────────┴──────────┬─────────────────┐
    ↓                    ↓                 ↓
origin-pst...      origin-wiki...    OCI bucket URL
(PAD Docker)       (future)          (future /cdn)
```

**Không** fetch `pst.hassasin.com` hay IP trực tiếp từ Worker → tránh error **1003**.

## DNS (zone `hassasin.com`)

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `pst` | `140.245.59.226` | **Proxied** (orange) |
| A | `origin-pst` | `140.245.59.226` | **DNS only** (grey) |

- `pst` — user-facing, Worker route `pst.hassasin.com/*`
- `origin-pst` — Worker → VM origin (PAD app qua Caddy :80)

SSL/TLS: **Flexible** hoặc **Full** (origin HTTP only).

## Deploy Worker

```bash
cd cloudflare/pst-gateway
npm install
npx wrangler login
npm run deploy
```

Route đã khai báo trong `wrangler.toml`. Sau deploy: Workers → `pst-gateway` → Routes.

## Thêm service mới

1. **DNS** — tạo grey-cloud origin (hoặc dùng OCI bucket URL)
2. **`wrangler.toml`** — thêm `ORIGIN_WIKI = "http://origin-wiki.hassasin.com"`
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

- `pst.hassasin.com/monsters/*`
- `pst.hassasin.com/admin/*`
- `pst.hassasin.com/patterns/*`
- `pst.hassasin.com/health`

## Verify (thứ tự deploy — tránh 502 tạm)

```bash
# 1. VM + Docker chạy
curl -s http://origin-pst.hassasin.com/health    # → {"ok":true}

# 2. Sau đó mới deploy Worker
curl -s https://pst.hassasin.com/health          # → {"ok":true}
```

**502 Bad gateway** thường do: Docker đang build/restart, `origin-pst` chưa có DNS grey, hoặc Worker deploy trước khi VM sẵn sàng. Đợi `deploy.cmd deploy` xong + health OK rồi `npm run deploy` Worker.
