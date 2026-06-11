/**
 * Path router for pst.hassasin.com
 *
 * Add new services here (longest prefix wins).
 * Each `origin` must be a hostname NOT proxied through Cloudflare (grey cloud DNS
 * or external URL like Oracle Object Storage).
 *
 * @typedef {object} Route
 * @property {string} name        — label for logs
 * @property {string} prefix      — path prefix, e.g. "/wiki"
 * @property {string} origin      — base URL (no trailing slash), from env or literal
 * @property {boolean} [spaFallback] — on 404 + Accept: html, retry GET on origin root path
 * @property {(path: string) => string} [mapPath] — optional path rewrite before proxy
 */

/** @param {Record<string, string>} env */
export function buildRoutes(env) {
  return [
    {
      name: 'pad-search',
      prefix: '/',
      origin: (env.ORIGIN_PAD || 'http://origin-pst.hassasin.com').replace(/\/$/, ''),
      spaFallback: true,
    },

    // ── Future services (uncomment & set ORIGIN_* in wrangler.toml) ─────────────
    //
    // {
    //   name: 'wiki',
    //   prefix: '/wiki',
    //   origin: (env.ORIGIN_WIKI || '').replace(/\/$/, ''),
    //   spaFallback: true,
    //   mapPath: (path) => (path === '/wiki' || path === '/wiki/' ? '/wiki/index.html' : path),
    // },
    //
    // {
    //   name: 'static-assets',
    //   prefix: '/cdn',
    //   origin: (env.ORIGIN_CDN || '').replace(/\/$/, ''),
    //   mapPath: (path) => path.replace(/^\/cdn/, '') || '/index.html',
    // },
  ].filter((r) => r.origin);
}

/**
 * @param {string} pathname
 * @param {Route[]} routes
 */
export function matchRoute(pathname, routes) {
  const sorted = [...routes].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const route of sorted) {
    if (route.prefix === '/') return route;
    if (pathname === route.prefix || pathname.startsWith(route.prefix + '/')) {
      return route;
    }
  }
  return null;
}
