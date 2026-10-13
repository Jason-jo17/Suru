/**
 * Reviewer sessions: a signed cookie, verified on every request by the
 * middleware. Web Crypto only, so the same code runs in the Edge middleware and
 * in Node route handlers.
 *
 * Configured by environment:
 *   AUTH_USERNAME   reviewer login name
 *   AUTH_PASSWORD   reviewer password
 *   AUTH_SECRET     long random string that signs the cookie; rotating it signs
 *                   everybody out
 */

export const SESSION_COOKIE = 'shurukar_session'
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7

export interface AuthConfig {
  username: string
  password: string
  secret: string
}

/** Null when any of the three is missing — callers must then fail closed. */
export function authConfig(): AuthConfig | null {
  const username = process.env.AUTH_USERNAME?.trim()
  const password = process.env.AUTH_PASSWORD
  const secret = process.env.AUTH_SECRET
  if (!username || !password || !secret || secret.length < 32) return null
  return { username, password, secret }
}

const encoder = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)))
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/**
 * Constant-time string comparison: both sides are MACed first, so the time
 * taken says nothing about how many leading characters matched.
 */
export async function safeEqual(secret: string, a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([hmac(secret, a), hmac(secret, b)])
  return equalBytes(x, y)
}

export async function createSessionToken(username: string, secret: string): Promise<string> {
  const payload = b64url(
    encoder.encode(JSON.stringify({ u: username, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_S })),
  )
  const sig = b64url(await hmac(secret, payload))
  return `${payload}.${sig}`
}

/** The signed-in username, or null for a missing, forged or expired token. */
export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<string | null> {
  if (!token) return null
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  try {
    const expected = await hmac(secret, payload)
    if (!equalBytes(expected, fromB64url(sig))) return null
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { u?: string; exp?: number }
    if (!data.u || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null
    return data.u
  } catch {
    return null
  }
}

/** Only same-site paths may be redirect targets after sign-in. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/candidates'
  return next
}
