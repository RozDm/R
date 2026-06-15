// Shared HTTP helper for the worker's JSON API responses.
import { ENFORCED_CSP, HSTS, applyBaseHeaders } from './csp'

export function apiJson(body: string, status = 200): Response {
  const response = new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
  applyBaseHeaders(response.headers)
  response.headers.set('Strict-Transport-Security', HSTS)
  response.headers.set('Content-Security-Policy', ENFORCED_CSP)
  return response
}
