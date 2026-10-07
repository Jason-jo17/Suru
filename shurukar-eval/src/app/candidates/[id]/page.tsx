import Link from 'next/link'
import { notFound } from 'next/navigation'
import FitCard from '@/components/FitCard'
import KeyboardNav from '@/components/KeyboardNav'
import ReviewerActionBar from '@/components/ReviewerActionBar'
import { BandChip, FlagChip } from '@/components/BandChip'
import { prisma } from '@/lib/db'
import { LABEL_PHRASES } from '@/lib/assemble/labels'
import { reviewExtras, reviewFits } from '@/lib/assemble/review'
import type { LayaAnswers } from '@/lib/laya/client'
import type { Scenario } from '@/lib/route'

export const dynamic = 'force-dynamic'

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export default async function CandidateDetail(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      responses: { orderBy: { fieldId: 'asc' } },
      seedBank: true,
      dossiers: { orderBy: { version: 'desc' } },
      assessments: { where: { isLatest: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })
  if (!candidate) return notFound()

  const [nextCand, prevCand] = await Promise.all([
    prisma.candidate.findFirst({
      where: { createdAt: { lt: candidate.createdAt } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }),
    prisma.candidate.findFirst({
      where: { createdAt: { gt: candidate.createdAt } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
  ])

  const asm = candidate.assessments[0] ?? null
  const dossier = candidate.dossiers[0] ?? null
  const layaRun = asm?.layaRunId
    ? await prisma.layaRun.findUnique({ where: { id: asm.layaRunId } })
    : null

  const scenario = (asm?.scenario ?? layaRun?.scenario ?? 'A') as Scenario
  const answers = parseJson<LayaAnswers>(layaRun?.answers, {})
  const flags = parseJson<string[]>(asm?.flags, [])
  const explanation = parseJson<string[]>(asm?.explanation, [])
  const dossierPayload = parseJson<Record<string, string>>(dossier?.payload, {})

  const fits = reviewFits(answers, scenario)
  const extras = reviewExtras(answers, scenario)
  const constraint = extras.find((e) => e.key === 'constraint_type')
  const submission = extras.find((e) => e.key === 'submission_real')
  const fitScores: Record<string, number | null> = {
    founderProblem: asm?.founderProblem ?? null,
    problemSolution: asm?.problemSolution ?? null,
    solutionMarket: asm?.solutionMarket ?? null,
  }
  const seedMissing = parseJson<string[]>(candidate.seedBank?.missingFields, [])

  return (
    <div className="min-h-screen bg-[#090D16] text-[#F8FAFC] p-4 md:p-8">
      <KeyboardNav prevId={prevCand?.id ?? null} nextId={nextCand?.id ?? null} />

      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#1E293B] font-mono text-xs">
          <Link href="/candidates" className="text-sky-300 hover:underline">
            ← all candidates
          </Link>
          <span className="flex items-center gap-2 text-[#64748B]">
            <kbd>J</kbd> next <kbd>K</kbd> previous <kbd>A</kbd>/<kbd>H</kbd>/<kbd>I</kbd> decide{' '}
            <kbd>N</kbd> note
          </span>
        </div>

        {/* 1 — header */}
        <header className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black font-mono tracking-tight">
                {candidate.externalId}
              </h1>
              <p className="text-xs text-[#94A3B8] mt-1 font-mono">
                {candidate.district} / {candidate.block} · {candidate.persona} · declared{' '}
                {candidate.declaredStage} · scored on set {scenario} · {candidate.language}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <BandChip band={asm?.band ?? 'unscored'} />
              <span className="text-[10px] font-mono text-[#64748B]">
                confidence{' '}
                {asm?.confidence === null || asm?.confidence === undefined
                  ? '—'
                  : asm.confidence.toFixed(2)}
              </span>
            </div>
          </div>

          {asm?.cappedBy && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2 text-xs">
              <span className="text-amber-300 font-semibold shrink-0">Capped</span>
              <span className="text-amber-100/90">{asm.cappedBy}</span>
            </div>
          )}

          {asm?.needsHuman && (
            <div className="flex items-start gap-2 bg-sky-500/10 border border-sky-500/30 rounded px-3 py-2 text-xs">
              <span className="text-sky-300 font-semibold shrink-0">Needs a human</span>
              <span className="text-sky-100/90">
                A decisive answer was missing or low-confidence. That is usually a thin dossier, not
                a weak founder — it is not a low score.
              </span>
            </div>
          )}

          {submission?.label === 'spam' && (
            <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded px-3 py-2 text-xs">
              <span className="text-rose-300 font-semibold shrink-0">Suspected spam</span>
              <span className="text-rose-100/90">
                submission_real came back &ldquo;spam&rdquo;. Flagged for a reviewer — nothing is
                auto-rejected.
              </span>
            </div>
          )}

          {/* constraint_type is near-zero in the composite and prominent here:
              it is what the programme acts on. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            <div className="bg-[#111827] border border-[#1E293B] rounded px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-[#64748B] font-mono">
                Asked for help with
              </div>
              <div className="text-sm font-semibold text-sky-300 mt-0.5">
                {constraint?.label ?? candidate.seedBank?.constraintType ?? '—'}
              </div>
              <div className="text-[10px] text-[#64748B] mt-0.5">
                {constraint?.label
                  ? (LABEL_PHRASES.constraint_type?.[constraint.label] ?? 'not scored')
                  : 'not scored'}
              </div>
            </div>
            <div className="bg-[#111827] border border-[#1E293B] rounded px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-[#64748B] font-mono">
                Registration
              </div>
              <div className="text-sm font-semibold mt-0.5">
                {candidate.seedBank?.status ?? '—'}
              </div>
            </div>
            <div className="bg-[#111827] border border-[#1E293B] rounded px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-[#64748B] font-mono">
                SEED Bank
              </div>
              <div
                className={`text-sm font-semibold mt-0.5 ${
                  candidate.seedBank?.complete ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                {candidate.seedBank?.complete ? 'complete' : 'incomplete'}
              </div>
              {seedMissing.length > 0 && (
                <div className="text-[10px] text-[#64748B] mt-0.5">
                  missing {seedMissing.join(', ')}
                </div>
              )}
            </div>
            <div className="bg-[#111827] border border-[#1E293B] rounded px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-[#64748B] font-mono">
                Aspiration
              </div>
              <div className="text-xs mt-0.5 text-[#94A3B8] line-clamp-3">
                {candidate.seedBank?.aspiration ?? '—'}
              </div>
            </div>
          </div>

          {flags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] uppercase tracking-wide text-[#64748B] font-mono mr-1">
                Flags
              </span>
              {flags.map((f) => (
                <FlagChip key={f} flag={f} />
              ))}
            </div>
          )}

          {explanation.length > 0 && (
            <div className="border-t border-[#1E293B] pt-3">
              <div className="text-[10px] uppercase tracking-wide text-[#64748B] font-mono mb-1.5">
                How this reads — assembled from the labels, not written by the model
              </div>
              <ul className="flex flex-col gap-1">
                {explanation.map((line, i) => (
                  <li key={i} className="text-xs text-[#94A3B8] leading-relaxed">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </header>

        {/* 2 — the three fits */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-[#94A3B8] font-mono uppercase tracking-wide">
            The three fits
          </h2>
          {fits.map((fit) => (
            <FitCard
              key={fit.fit}
              title={fit.title}
              score={fitScores[fit.fit]}
              floor={fit.floor}
              questions={fit.questions}
              missing={fit.missing}
              cappedHere={
                fitScores[fit.fit] !== null && (fitScores[fit.fit] as number) < fit.floor
              }
            />
          ))}
          {extras.length > 0 && (
            <FitCard
              title="Other questions — authenticity and constraint"
              score={null}
              floor={0}
              questions={extras}
              missing={[]}
            />
          )}
        </section>

        {/* 3 — the dossier, exactly as sent */}
        <section className="bg-[#0F172A] border border-[#1E293B] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">The dossier — exactly what the model saw</h2>
            <span className="text-[10px] font-mono text-[#64748B]">
              v{dossier?.version ?? '—'} · {dossier?.tokenCount ?? 0} tokens ·{' '}
              {dossier?.distillerVersion ?? '—'}
              {candidate.dossiers.length > 1 && ` · ${candidate.dossiers.length} versions on record`}
            </span>
          </div>
          <div className="p-4">
            {Object.keys(dossierPayload).length === 0 ? (
              <p className="text-xs text-[#64748B] italic">No dossier recorded.</p>
            ) : (
              <dl className="flex flex-col divide-y divide-[#1E293B]">
                {Object.entries(dossierPayload).map(([key, value], i) => (
                  <div key={key} className="grid grid-cols-[180px_1fr] gap-3 py-2">
                    <dt className="text-[11px] font-mono text-sky-300/80">
                      {key}
                      {i < 5 && (
                        <span className="ml-1.5 text-[9px] text-[#475569]" title="never truncated">
                          decisive
                        </span>
                      )}
                    </dt>
                    <dd className="text-xs text-[#E2E8F0] break-words">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="text-[10px] text-[#64748B] mt-3 pt-3 border-t border-[#1E293B] font-mono">
              Identity stripped: no name, gender, age, caste or institution name. VERIFIED marks a
              dated external figure; CLAIMED marks the founder&apos;s own unverified number.
            </p>
          </div>
        </section>

        {/* 4 — the raw answers, so a reviewer can check the distiller */}
        <section className="bg-[#0F172A] border border-[#1E293B] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E293B] flex items-center justify-between">
            <h2 className="text-sm font-semibold">The raw answers — check the distiller</h2>
            <span className="text-[10px] font-mono text-[#64748B]">
              {candidate.responses.length} fields as submitted
            </span>
          </div>
          <div className="p-4">
            <dl className="flex flex-col divide-y divide-[#1E293B]">
              {candidate.responses.map((r) => (
                <div key={r.id} className="grid grid-cols-[180px_1fr] gap-3 py-2">
                  <dt className="text-[11px] font-mono text-[#64748B]">{r.fieldId}</dt>
                  <dd className="text-xs text-[#94A3B8] break-words">{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* 5 — reviewer action */}
        <ReviewerActionBar
          candidateId={candidate.id}
          currentDecision={asm?.reviewerDecision ?? null}
          currentNote={asm?.reviewerNote ?? null}
          reviewedBy={asm?.reviewedBy ?? null}
          reviewedAt={asm?.reviewedAt ? asm.reviewedAt.toISOString().slice(0, 16).replace('T', ' ') : null}
        />

        <footer className="text-[10px] font-mono text-[#475569] pb-6">
          run {layaRun?.id ?? '—'} · question set {asm?.questionSetVersion ?? '—'} · checkpoint{' '}
          {asm?.modelCheckpoint ?? '—'} · latency {layaRun?.latencyMs ?? '—'}ms
          {layaRun?.error && <span className="text-amber-400/80"> · {layaRun.error}</span>}
          <br />
          Scores from different question-set versions are not comparable and are never ranked
          together.
        </footer>
      </div>
    </div>
  )
}
