/**
 * Vercel serverless: proxies the official `api-web.nhle.com` JSON so the browser
 * is not blocked by CORS in production. Query: `year` (e.g. 2026 for 2025-26).
 */
export default async function handler(req, res) {
  const y =
    (req.query && (req.query.year ?? req.query.season)) != null
      ? String(req.query.year ?? req.query.season)
      : '2026'
  const u = `https://api-web.nhle.com/v1/playoff-bracket/${encodeURIComponent(y)}`
  const r = await fetch(u, { headers: { Accept: 'application/json' } })
  const text = await r.text()
  const ct = r.headers.get('content-type') || 'application/json; charset=utf-8'
  res.setHeader('Content-Type', ct)
  res.status(r.status).send(text)
}
