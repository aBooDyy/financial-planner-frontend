// Forwards `/api/*` to the backend so the browser only ever talks to this origin: the
// auth cookies are then first-party and keep working under `SameSite=Strict`.

type Env = {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  BACKEND_ORIGIN?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    if (!env.BACKEND_ORIGIN) {
      return new Response('BACKEND_ORIGIN is not configured.', { status: 500 })
    }

    const headers = new Headers(request.headers)
    headers.delete('host')
    const clientIp = request.headers.get('cf-connecting-ip')
    if (clientIp) headers.set('x-forwarded-for', clientIp)

    return fetch(new URL(url.pathname + url.search, env.BACKEND_ORIGIN), {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'manual',
    })
  },
}
