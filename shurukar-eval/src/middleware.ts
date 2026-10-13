import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, authConfig, verifySessionToken } from '@/lib/auth/session'

/**
 * Every page here shows founders' names and answers, the export hands out the
 * whole cohort, and /api/score spends model time — so nothing is served
 * without a signed-in reviewer.
 *
 * Fails closed: on a production server with the AUTH_* variables missing, every
 * request is refused rather than the app quietly opening up. Only a local
 * `next dev` runs open without them.
 */
export async function middleware(request: NextRequest) {
  const config = authConfig()
  const isApi = request.nextUrl.pathname.startsWith('/api/')

  if (!config) {
    if (process.env.NODE_ENV !== 'production') return NextResponse.next()
    return new NextResponse(
      'Sign-in is not configured: set AUTH_USERNAME, AUTH_PASSWORD and AUTH_SECRET (32+ characters).',
      { status: 503 },
    )
  }

  const user = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, config.secret)
  if (user) return NextResponse.next()

  if (isApi) return NextResponse.json({ error: 'sign in required' }, { status: 401 })

  const login = new URL('/login', request.url)
  const next = request.nextUrl.pathname + request.nextUrl.search
  if (next !== '/') login.searchParams.set('next', next)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ['/((?!login|api/auth|api/health|_next/static|_next/image|favicon.ico).*)'],
}
