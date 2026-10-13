import { NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  authConfig,
  createSessionToken,
  safeEqual,
  safeNextPath,
} from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

/** Plain form post from /login, so sign-in works without client JavaScript. */
export async function POST(request: Request) {
  const form = await request.formData()
  const username = String(form.get('username') ?? '').trim()
  const password = String(form.get('password') ?? '')
  const next = safeNextPath(String(form.get('next') ?? ''))

  const config = authConfig()
  const back = (error: string) => {
    const url = new URL('/login', request.url)
    url.searchParams.set('error', error)
    if (next !== '/candidates') url.searchParams.set('next', next)
    return NextResponse.redirect(url, 303)
  }
  if (!config) return back('not_configured')

  const [userOk, passOk] = await Promise.all([
    safeEqual(config.secret, username, config.username),
    safeEqual(config.secret, password, config.password),
  ])
  if (!userOk || !passOk) {
    // A fixed pause per failure makes guessing slow without tracking state.
    await new Promise((r) => setTimeout(r, 500))
    return back('invalid')
  }

  const res = NextResponse.redirect(new URL(next, request.url), 303)
  res.cookies.set(SESSION_COOKIE, await createSessionToken(config.username, config.secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && new URL(request.url).protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_S,
  })
  return res
}
