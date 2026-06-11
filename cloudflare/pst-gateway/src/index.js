import { buildRoutes, matchRoute } from './routes.js';

/**
 * @param {Request} request
 * @param {Record<string, string>} env
 */
async function proxyToOrigin(request, env, route) {
  const url = new URL(request.url);
  const path = route.mapPath ? route.mapPath(url.pathname) : url.pathname;
  const originBase = new URL(route.origin);
  const originUrl = route.origin + path + url.search;

  const headers = new Headers(request.headers);
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ray');
  headers.delete('cf-ipcountry');
  headers.set('Host', originBase.host);
  headers.set('X-Forwarded-Host', url.host);
  headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

  const originReq = new Request(originUrl, {
    method: request.method,
    headers,
    body:
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : request.body,
    redirect: 'manual',
  });

  let originRes = await fetch(originReq);

  if (
    route.spaFallback &&
    originRes.status === 404 &&
    request.headers.get('accept')?.includes('text/html')
  ) {
    const fallbackPath = route.prefix === '/' ? '/' : route.prefix;
    const fallbackUrl = route.origin + fallbackPath + url.search;
    originRes = await fetch(fallbackUrl, {
      method: 'GET',
      headers: { Accept: 'text/html' },
      redirect: 'manual',
    });
  }

  return new Response(originRes.body, {
    status: originRes.status,
    statusText: originRes.statusText,
    headers: originRes.headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const publicHost = env.PUBLIC_HOST || 'pst.hassasin.com';

    if (url.hostname !== publicHost) {
      return new Response('Not found', { status: 404 });
    }

    const routes = buildRoutes(env);
    const route = matchRoute(url.pathname, routes);

    if (!route) {
      return new Response('Not found', { status: 404 });
    }

    try {
      return await proxyToOrigin(request, env, route);
    } catch (err) {
      console.error({ route: route.name, error: String(err) });
      return new Response('Origin unreachable', { status: 502 });
    }
  },
};
