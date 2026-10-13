import Link from 'next/link'

/** The signed-in shell: ShuruKar navigation beside the reviewer screens. */
export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-brand text-brand-fg sticky top-0 h-screen">
        <Link href="/candidates" className="px-7 pt-8 pb-10 block">
          <span className="font-display text-[2rem] font-semibold leading-none tracking-tight">
            Shuru Kar
          </span>
        </Link>
        <nav className="px-4 flex flex-col gap-1 text-[15px]">
          <Link
            href="/candidates"
            className="flex items-center gap-3 rounded-full px-4 py-2.5 bg-white/10 font-medium"
          >
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Candidates
          </Link>
        </nav>
        <div className="mt-auto m-4 flex flex-col gap-3">
          <div className="rounded-2xl bg-white/[0.07] p-5 text-sm">
            <p className="font-display text-lg font-semibold leading-tight">Review faster</p>
            <p className="mt-2 text-white/70 leading-relaxed">
              <kbd>J</kbd> <kbd>K</kbd> move · <kbd>/</kbd> search
              <br />
              <kbd>A</kbd> <kbd>H</kbd> <kbd>I</kbd> decide · <kbd>N</kbd> note
            </p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 min-w-0 canvas-wash">{children}</main>
    </div>
  )
}
