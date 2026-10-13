import { safeNextPath } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

const ERRORS: Record<string, string> = {
  invalid: 'That username and password do not match.',
  not_configured: 'Sign-in is not configured on this server yet.',
}

export default async function LoginPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await props.searchParams
  const one = (k: string) => {
    const v = params[k]
    return Array.isArray(v) ? v[0] : v
  }
  const error = ERRORS[one('error') ?? '']
  const next = safeNextPath(one('next'))

  return (
    <div className="min-h-screen flex">
      <section className="hidden lg:flex w-[44%] bg-brand text-brand-fg flex-col justify-between p-12">
        <span className="font-display text-[2.5rem] font-semibold leading-none tracking-tight">
          Shuru Kar
        </span>
        <div>
          <p className="font-display text-4xl font-semibold leading-tight max-w-md">
            Every founder gets read, not just ranked.
          </p>
          <p className="mt-4 text-white/70 max-w-md leading-relaxed">
            The reviewer workbench for the ShuruKar cohort — Laya&apos;s assessment beside each
            founder&apos;s own words, so a person makes the call.
          </p>
        </div>
        <p className="text-sm text-white/50">For ShuruKar reviewers only.</p>
      </section>

      <main className="flex-1 canvas-wash flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <span className="lg:hidden block font-display text-3xl font-semibold text-ink mb-8 text-center">
            Shuru Kar
          </span>
          <div className="bg-surface border border-line rounded-card shadow-card p-8">
            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-900 px-3 py-0.5 text-sm font-medium">
              Reviewer access
            </span>
            <h1 className="font-display text-3xl font-semibold text-ink mt-4">Sign in</h1>
            <p className="text-ink-3 mt-1">Founder review — Shurukar cohort</p>

            {error && (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
              >
                {error}
              </div>
            )}

            <form action="/api/auth/login" method="post" className="mt-6 flex flex-col gap-4">
              <input type="hidden" name="next" value={next} />
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink-2">Username</span>
                <input
                  name="username"
                  autoComplete="username"
                  required
                  autoFocus
                  className="rounded-xl border border-line-strong bg-surface px-4 py-3 text-ink placeholder:text-ink-4 focus:outline-none focus:border-ink-3 focus:ring-4 focus:ring-accent-soft"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink-2">Password</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="rounded-xl border border-line-strong bg-surface px-4 py-3 text-ink focus:outline-none focus:border-ink-3 focus:ring-4 focus:ring-accent-soft"
                />
              </label>
              <button
                type="submit"
                className="mt-2 rounded-full bg-accent hover:bg-accent-hover text-white px-5 py-3 font-semibold shadow-sm transition-colors"
              >
                Sign in
              </button>
            </form>
          </div>
          <p className="text-center text-xs text-ink-4 mt-6">
            Founders&apos; answers are confidential. Do not share access.
          </p>
        </div>
      </main>
    </div>
  )
}
