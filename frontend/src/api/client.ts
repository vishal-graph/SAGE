/**
 * - In dev, prefer **no** `VITE_API_URL` → use `/api` so Vite proxies (fewer browser NetworkErrors than direct 127.0.0.1).
 * - If `VITE_API_URL` is set → call that origin directly (must match uvicorn; CORS must allow the page origin).
 * - Set `VITE_PROXY_TARGET` (or `VITE_API_URL`) in frontend/.env so Vite knows the API port (default 8889).
 * - Production build without env → last-resort localhost (override in deploy).
 */
export function getApiBase(): string {
  const explicit = import.meta.env.VITE_API_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  if (import.meta.env.DEV) return '/api'
  return 'http://127.0.0.1:8000'
}

export function getApiWebSocketBase(): string {
  const base = getApiBase()
  if (base.startsWith('https://')) return `wss://${base.slice('https://'.length)}`
  if (base.startsWith('http://')) return `ws://${base.slice('http://'.length)}`
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}${base}`
  }
  return `ws://127.0.0.1:8000`
}

const AUTH_TOKEN_STORAGE_KEY = 'sige.auth.token'

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
}

export function setStoredAuthToken(token: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
}

export function clearStoredAuthToken() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
}

export function appendAuthToken(url: string): string {
  const token = getStoredAuthToken()
  if (!token) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}token=${encodeURIComponent(token)}`
}

/** Thrown for non-OK API responses so callers can read HTTP status. */
export class HttpApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpApiError'
    this.status = status
  }
}

/** Turn FastAPI `{ "detail": "..." }` (or validation array) into a short user-facing message. */
function formatApiErrorBody(text: string, status: number): string {
  const raw = text.trim()
  if (!raw) {
    if (status === 502 || status === 503)
      return `Bad gateway (${status}) — Vite could not proxy to the API. Fix: open a terminal in the SIGE folder and run npm run dev (starts API + web), or start backend\\run_api.bat then set frontend/.env to VITE_API_URL=http://127.0.0.1:8889 and restart npm run dev.`
    if (status === 404)
      return 'Not found — API route missing. Restart uvicorn from the latest SIGE/backend code.'
    return `Request failed (${status})`
  }
  try {
    const j = JSON.parse(raw) as { detail?: unknown }
    const d = j.detail
    if (typeof d === 'string') {
      if (status === 404 && d === 'Not Found')
        return 'API route not found. Open /health on the same URL as VITE_API_URL (default http://127.0.0.1:8889/health). You need ai_clean_floorplan_image: true. If false: stop old uvicorn, then run backend\\run_api.bat from SIGE\\backend (uses port 8889 so it does not clash with an old server on 8888).'
      return d
    }
    if (Array.isArray(d)) {
      return d
        .map((x) =>
          typeof x === 'object' && x !== null && 'msg' in x
            ? String((x as { msg: string }).msg)
            : JSON.stringify(x),
        )
        .join('; ')
    }
    if (d != null && typeof d === 'object') return JSON.stringify(d)
  } catch {
    /* not JSON */
  }
  return raw.length > 600 ? `${raw.slice(0, 600)}…` : raw
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    const token = getStoredAuthToken()
    res = await fetch(`${getApiBase()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
  } catch (e) {
    const base = getApiBase()
    const health = base.startsWith('http') ? `${base}/health` : ''
    const hint =
      base.startsWith('http')
        ? [
            `Cannot reach ${base}.`,
            health ? `Open ${health} in this browser — if it fails, the API is not running.` : '',
            'Start it: from repo root run npm run dev (starts API + Vite), or double-click backend\\run_api.bat.',
            'After editing backend code, stop uvicorn (Ctrl+C) and start it again.',
            'Port stuck? Run backend\\stop_api_8889.bat then run_api.bat.',
            'Still failing? In frontend/.env try removing VITE_API_URL so requests use the Vite /api proxy instead.',
          ]
            .filter(Boolean)
            .join(' ')
        : `Network error calling ${base}${path}. Is uvicorn running and VITE_PROXY_TARGET correct (port 8889)?`
    throw new Error(`${hint} ${e instanceof Error ? `(${e.message})` : ''}`.trim())
  }
  if (!res.ok) {
    const text = await res.text()
    throw new HttpApiError(res.status, formatApiErrorBody(text, res.status))
  }
  return res.json() as Promise<T>
}

export async function getJson<T>(path: string): Promise<T> {
  let res: Response
  try {
    const token = getStoredAuthToken()
    res = await fetch(`${getApiBase()}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
  } catch (e) {
    const base = getApiBase()
    const health = base.startsWith('http') ? `${base}/health` : ''
    throw new Error(
      [
        `Cannot reach API (${base}).`,
        health ? `Check ${health} in the browser.` : '',
        'Start backend\\run_api.bat or npm run dev from the repo root.',
        'Port in use: backend\\stop_api_8889.bat then restart.',
        e instanceof Error ? e.message : String(e),
      ]
        .filter(Boolean)
        .join(' '),
    )
  }
  if (!res.ok) throw new HttpApiError(res.status, formatApiErrorBody(await res.text(), res.status))
  return res.json() as Promise<T>
}

export async function postFile<T>(path: string, file: File): Promise<T> {
  const token = getStoredAuthToken()
  const form = new FormData()
  form.append('file', file)

  let res: Response
  try {
    res = await fetch(`${getApiBase()}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    })
  } catch (e) {
    throw new Error(
      `Network error uploading file to ${getApiBase()}${path}. ${e instanceof Error ? e.message : String(e)}`,
    )
  }
  if (!res.ok) throw new HttpApiError(res.status, formatApiErrorBody(await res.text(), res.status))
  return res.json() as Promise<T>
}

export function createAuthedWebSocket(path: string): WebSocket {
  const token = getStoredAuthToken()
  if (!token) throw new Error('Authentication required')
  const sep = path.includes('?') ? '&' : '?'
  return new WebSocket(`${getApiWebSocketBase()}${path}${sep}token=${encodeURIComponent(token)}`)
}
