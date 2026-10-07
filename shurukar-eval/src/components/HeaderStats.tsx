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
    { label: 'strong', value: String(bands.strong), href: '/candidates?band=strong', tone: 'text-emerald-300' },
    { label: 'promising', value: String(bands.promising), href: '/candidates?band=promising', tone: 'text-sky-300' },
    { label: 'early', value: String(bands.early), href: '/candidates?band=early', tone: 'text-amber-300' },
    { label: 'unscored', value: String(bands.unscored), href: '/candidates?unscored=true', tone: 'text-slate-300' },
    { label: 'needs a human', value: String(needsHuman), href: '/candidates?needsHuman=true', tone: 'text-sky-300' },
    { label: 'flagged', value: String(flagged), href: '/candidates?hasFlags=true', tone: 'text-amber-300' },
    { label: 'reviewed', value: `${reviewed}/${assessments.length}` },
    { label: 'seed bank', value: `${seedComplete}/${total}` },
  ]

  return (
    <div className="mb-4 grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
      {cells.map((c) => {
        const body = (
          <>
            <div className={`text-lg font-black font-mono ${c.tone ?? 'text-[#F8FAFC]'}`}>
              {c.value}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-[#64748B] font-mono mt-0.5">
              {c.label}
            </div>
          </>
        )
        return c.href ? (
          <a
            key={c.label}
            href={c.href}
            className="bg-[#0F172A] border border-[#1E293B] rounded-lg px-3 py-2 hover:border-[#334155] transition-colors"
          >
            {body}
          </a>
        ) : (
          <div
            key={c.label}
            className="bg-[#0F172A] border border-[#1E293B] rounded-lg px-3 py-2"
          >
            {body}
          </div>
        )
      })}
      {questionSets.length > 1 && (
        <div className="col-span-full text-[10px] font-mono text-amber-400/80 px-1">
          {questionSets.length} question-set versions present —{' '}
          {questionSets.map((q) => q.questionSetVersion).join(', ')}. Scores from different versions
          are not comparable; filter to one before ranking.
        </div>
      )}
    </div>
  )
}
