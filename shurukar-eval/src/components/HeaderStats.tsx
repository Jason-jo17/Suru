import { prisma } from '@/lib/db'

/**
 * Cohort ribbon. Counts, not an average — there is deliberately no single
 * headline number anywhere in this UI, because the one number is the thing most
 * likely to be acted on without reading anything else.
 */
export default async function HeaderStats() {
  const [total, assessments, seedComplete, questionSets] = await Promise.all([
    prisma.candidate.count(),
    prisma.assessment.findMany({
      where: { isLatest: true },
      select: {
        band: true,
        flags: true,
        needsHuman: true,
        reviewerDecision: true,
        questionSetVersion: true,
      },
    }),
    prisma.seedBankRecord.count({ where: { complete: true } }),
    prisma.assessment.findMany({
      where: { isLatest: true, questionSetVersion: { not: null } },
      distinct: ['questionSetVersion'],
      select: { questionSetVersion: true },
    }),
  ])

  const bands: Record<string, number> = { strong: 0, promising: 0, early: 0, unscored: 0 }
  let flagged = 0
  let needsHuman = 0
  let reviewed = 0

  for (const a of assessments) {
    bands[a.band] = (bands[a.band] ?? 0) + 1
    if (a.needsHuman) needsHuman++
    if (a.reviewerDecision) reviewed++
    try {
      if ((JSON.parse(a.flags) as string[]).length > 0) flagged++
    } catch {
      // a row with unreadable flags is still counted in its band
    }
  }

  const cells: Array<{ label: string; value: string; href?: string; tone?: string }> = [
    { label: 'candidates', value: String(total) },
    { label: 'strong', value: String(bands.strong), href: '/candidates?band=strong', tone: 'text-emerald-700' },
    { label: 'promising', value: String(bands.promising), href: '/candidates?band=promising', tone: 'text-indigo-700' },
    { label: 'early', value: String(bands.early), href: '/candidates?band=early', tone: 'text-amber-700' },
    { label: 'unscored', value: String(bands.unscored), href: '/candidates?unscored=true', tone: 'text-slate-700' },
    { label: 'needs human', value: String(needsHuman), href: '/candidates?needsHuman=true', tone: 'text-indigo-700' },
    { label: 'flagged', value: String(flagged), href: '/candidates?hasFlags=true', tone: 'text-amber-700' },
    { label: 'reviewed', value: `${reviewed}/${assessments.length}` },
    { label: 'seed bank', value: `${seedComplete}/${total}` },
  ]

  return (
    <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
      {cells.map((c) => {
        const body = (
          <>
            <div className="text-sm text-ink-2 first-letter:uppercase">{c.label}</div>
            <div className={`text-3xl font-bold font-mono mt-1 leading-none ${c.tone ?? 'text-ink'}`}>
              {c.value}
            </div>
          </>
        )
        return c.href ? (
          <a
            key={c.label}
            href={c.href}
            className="bg-surface border border-line rounded-card shadow-card px-4 py-4 hover:border-line-strong hover:-translate-y-px transition"
          >
            {body}
          </a>
        ) : (
          <div
            key={c.label}
            className="bg-surface border border-line rounded-card shadow-card px-4 py-4"
          >
            {body}
          </div>
        )
      })}
      {questionSets.length > 1 && (
        <div className="col-span-full text-[10px] font-mono text-amber-700 px-1">
          {questionSets.length} question-set versions present —{' '}
          {questionSets.map((q) => q.questionSetVersion).join(', ')}. Scores from different versions
          are not comparable; filter to one before ranking.
        </div>
      )}
    </div>
  )
}
