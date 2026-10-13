import { prisma } from '@/lib/db'

/**
 * Two cohort questions the band columns cannot answer: what is being built, and
 * what the people building it say they need.
 *
 * Both read the SEED Bank rather than the assessment, so they count every
 * candidate — including the ones who stopped after the router and will never be
 * banded. At a 15,000 target those people are most of the regional
 * intelligence, and a panel that only counted scored candidates would quietly
 * describe the wrong cohort.
 */

const SECTOR_LABELS: Record<string, string> = {
  agriculture: 'Agriculture',
  food_processing: 'Food processing',
  textiles_handicraft: 'Textiles & handicraft',
  retail_trading: 'Retail & trading',
  manufacturing: 'Manufacturing',
  repair_services: 'Repair & services',
  education_training: 'Education & training',
  health_wellness: 'Health & wellness',
  logistics_transport: 'Logistics & transport',
  digital_software: 'Digital & software',
  tourism_hospitality: 'Tourism & hospitality',
  financial_services: 'Financial services',
  other: 'Other',
  unclear: 'Could not tell',
}

/**
 * The constraint answer is the founder's own words for what would help, taken
 * from the first question on every branch. Intake wording differs by branch
 * (build / bring to market / grow), so the shapes are folded together here.
 */
const NEED_LABELS: Record<string, string> = {
  money: 'Money',
  needs_capital: 'Money',
  'learning and know-how': 'Learning & know-how',
  needs_skill: 'Learning & know-how',
  'the right team': 'The right team',
  'a place or machinery': 'Space or machinery',
  'a bigger place or machinery': 'Space or machinery',
  needs_capacity: 'Space or machinery',
  'a mentor or adviser': 'A mentor',
  'access to customers': 'Access to customers',
  'more customers': 'Access to customers',
  demand: 'Access to customers',
  'a first customer': 'A first customer',
  'a licence or registration': 'Licence or registration',
  needs_partner: 'Licence or registration',
  'knowing how to sell': 'Knowing how to sell',
  'improving the product': 'Improving the product',
  buildable: 'Just time and effort',
  unclear: 'Not stated',
  // Short tokens, as the exports and the test fixtures carry them.
  skills: 'Learning & know-how',
  team: 'The right team',
  network: 'Access to customers',
  customers: 'Access to customers',
  space: 'Space or machinery',
  machinery: 'Space or machinery',
  mentor: 'A mentor',
  licence: 'Licence or registration',
  registration: 'Licence or registration',
  selling: 'Knowing how to sell',
  product: 'Improving the product',
}

function pretty(raw: string, table: Record<string, string>): string {
  const key = raw.trim().toLowerCase()
  return table[key] ?? raw.trim().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

interface Tallied {
  label: string
  count: number
  /** The stored value, so a link filters on what is in the column. */
  raw: string
}

function tally(rows: Array<{ value: string | null }>, table: Record<string, string>): Tallied[] {
  const counts = new Map<string, Tallied>()
  for (const r of rows) {
    if (!r.value || r.value.trim() === '') continue
    const raw = r.value.trim().toLowerCase()
    const label = pretty(r.value, table)
    const existing = counts.get(label)
    if (existing) existing.count++
    else counts.set(label, { label, count: 1, raw })
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function Bars({
  rows,
  total,
  empty,
  linkAs,
}: {
  rows: Tallied[]
  total: number
  empty: string
  linkAs?: 'sector'
}) {
  if (rows.length === 0) {
    return <p className="text-[11px] text-ink-3 font-mono px-1 py-2">{empty}</p>
  }
  const max = rows[0].count
  return (
    <ul className="flex flex-col gap-1">
      {rows.map(({ label, count: n, raw }) => {
        const row = (
          <div className="flex items-center gap-2">
            <div className="w-[46%] shrink-0 truncate text-[11px] text-ink-2" title={label}>
              {label}
            </div>
            <div className="flex-1 h-2 rounded-full bg-canvas overflow-hidden">
              <div
                className="h-full bg-brand rounded-full"
                style={{ width: `${Math.max(3, Math.round((n / max) * 100))}%` }}
              />
            </div>
            <div className="w-14 shrink-0 text-right text-[11px] font-mono text-ink">
              {n}
              <span className="text-ink-3">
                {' '}
                {total > 0 ? `${Math.round((n / total) * 100)}%` : ''}
              </span>
            </div>
          </div>
        )
        return (
          <li key={label}>
            {linkAs === 'sector' ? (
              <a
                href={`/candidates?sector=${encodeURIComponent(raw)}`}
                className="block hover:bg-muted rounded px-1 py-0.5 -mx-1"
              >
                {row}
              </a>
            ) : (
              <div className="px-1 py-0.5">{row}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export default async function CohortIntelligence() {
  const records = await prisma.seedBankRecord.findMany({
    select: { sector: true, constraintType: true },
  })

  const sectors = tally(
    records.map((r) => ({ value: r.sector })),
    SECTOR_LABELS,
  )
  const needs = tally(
    records.map((r) => ({ value: r.constraintType })),
    NEED_LABELS,
  )

  const withSector = records.filter((r) => r.sector && r.sector !== 'unclear').length
  const distinctSectors = sectors.filter((s) => s.raw !== 'unclear').length
  const withNeed = records.filter((r) => r.constraintType).length

  return (
    <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
      <section className="bg-surface border border-line rounded-card shadow-card p-6">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-display text-lg font-semibold text-ink">
            What is being built
          </h2>
          <span className="text-[10px] font-mono text-ink-3">
            {withSector} solutions · {distinctSectors} sectors
          </span>
        </div>
        <Bars
          rows={sectors}
          total={records.length}
          linkAs="sector"
          empty="No sectors yet — sector is derived during scoring, so run the pipeline first."
        />
        <p className="mt-2 text-[10px] text-ink-3 font-mono leading-relaxed">
          Derived by the model from the founder&apos;s own description; intake never asks it. Treat
          as reviewable, not ground truth.
        </p>
      </section>

      <section className="bg-surface border border-line rounded-card shadow-card p-6">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-display text-lg font-semibold text-ink">
            What founders are looking for
          </h2>
          <span className="text-[10px] font-mono text-ink-3">{withNeed} answered</span>
        </div>
        <Bars
          rows={needs}
          total={records.length}
          empty="No answers yet — this comes from the first question on each branch."
        />
        <p className="mt-2 text-[10px] text-ink-3 font-mono leading-relaxed">
          Their own answer to &quot;what would help&quot;, captured at intake for everyone — scored
          or not. This is what the programme acts on, not what it ranks.
        </p>
      </section>
    </div>
  )
}
