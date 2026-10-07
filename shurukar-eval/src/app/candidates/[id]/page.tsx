import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import KeyboardNav from '@/components/KeyboardNav'
import FitCard from '@/components/FitCard'
import ReviewerActionBar from '@/components/ReviewerActionBar'

export default async function CandidateDetail(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: {
      responses: true,
      dossiers: { orderBy: { version: 'desc' }, take: 1 },
      assessments: { 
        orderBy: { createdAt: 'desc' }, 
        take: 1
      }
    }
  })

  if (!candidate) return notFound()

  // Linear keyboard navigation between candidates
  const [prevCand, nextCand] = await Promise.all([
    prisma.candidate.findFirst({
      where: { createdAt: { gt: candidate.createdAt } },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.candidate.findFirst({
      where: { createdAt: { lt: candidate.createdAt } },
      orderBy: { createdAt: 'desc' }
    })
  ])

  const asm = candidate.assessments[0]
  const dossier = candidate.dossiers[0]
  
  let layaRun: any = null
  if (asm?.layaRunId) {
    layaRun = await prisma.layaRun.findUnique({
      where: { id: asm.layaRunId }
    })
  }

  let flags: string[] = []
  try {
    flags = asm ? JSON.parse(asm.flags) : []
  } catch {}

  let answers: Record<string, any> = {}
  if (layaRun && layaRun.answers) {
    try { 
      answers = JSON.parse(layaRun.answers) 
    } catch {}
  }

  // Parse questions by fit
  const parseFitQuestions = (prefix: string) => {
    return Object.entries(answers)
      .filter(([key]) => key.toLowerCase().includes(prefix) || key.startsWith(prefix))
      .map(([key, val]) => ({
        key,
        choice: val?.choice || 'N/A',
        confidence: val?.confidence || '0.00',
        probabilities: val?.probabilities || {}
      }))
  }

  const founderProblemQuestions = Object.entries(answers)
    .filter(([key]) => key.includes('fp_') || key.includes('founder') || key.includes('proximity'))
    .map(([key, val]) => ({
      key,
      choice: val?.choice || 'N/A',
      confidence: val?.confidence || '0.00'
    }))

  const problemSolutionQuestions = Object.entries(answers)
    .filter(([key]) => key.includes('ps_') || key.includes('solution') || key.includes('problem'))
    .map(([key, val]) => ({
      key,
      choice: val?.choice || 'N/A',
      confidence: val?.confidence || '0.00'
    }))

  const solutionMarketQuestions = Object.entries(answers)
    .filter(([key]) => key.includes('sm_') || key.includes('market') || key.includes('traction') || key.includes('paying'))
    .map(([key, val]) => ({
      key,
      choice: val?.choice || 'N/A',
      confidence: val?.confidence || '0.00'
    }))

  // Parse dossier payload
  let dossierJson: any = {}
  try {
    dossierJson = dossier ? JSON.parse(dossier.payload) : {}
  } catch {}

  // Approximate token count: 1 token ~= 4 chars
  const payloadStr = dossier?.payload || ''
  const approxTokens = Math.round(payloadStr.length / 4)

  return (
    <div className="min-h-screen bg-[#090D16] text-[#F8FAFC] p-4 md:p-8 flex flex-col font-sans">
      <KeyboardNav prevId={prevCand?.id || null} nextId={nextCand?.id || null} />

      {/* Top Utility Header */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between pb-4 border-b border-[#1E293B] mb-6 font-mono text-xs">
        <Link 
          href="/candidates" 
          className="text-[#94A3B8] hover:text-white transition-colors flex items-center gap-1.5"
        >
          <span>←</span> Back to Candidate Sheet
        </Link>

        <div className="flex items-center gap-4">
          {prevCand ? (
            <Link 
              href={`/candidates/${prevCand.id}`} 
              className="text-[#94A3B8] hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <kbd>K</kbd> Prev ({prevCand.externalId})
            </Link>
          ) : (
            <span className="text-[#475569]">First candidate</span>
          )}

          <span className="text-[#334155]">|</span>

          {nextCand ? (
            <Link 
              href={`/candidates/${nextCand.id}`} 
              className="text-[#94A3B8] hover:text-white flex items-center gap-1.5 transition-colors"
            >
              Next ({nextCand.externalId}) <kbd>J</kbd>
            </Link>
          ) : (
            <span className="text-[#475569]">Last candidate</span>
          )}
        </div>
      </div>

      <div className="max-w-6xl w-full mx-auto flex flex-col gap-6 flex-1">
        {/* Candidate Identity Card */}
        <section className="p-6 bg-[#0F172A] border border-[#1E293B] rounded-xl shadow-lg font-mono">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                  {candidate.externalId}
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#1E293B] text-[#94A3B8] border border-[#334155]">
                  ID: {candidate.id.slice(0, 10)}...
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-1">
                Intake Source: Google Forms / WhatsApp · Recorded: {new Date(candidate.createdAt).toLocaleDateString()}
              </p>
            </div>

            {/* Band Badge */}
            <div className="text-right">
              <span className="text-[10px] text-[#64748B] uppercase tracking-wider block font-bold mb-1">Assessment Band</span>
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
                asm?.band === 'strong' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                asm?.band === 'promising' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30' :
                asm?.band === 'early' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                'bg-[#1E293B] text-[#94A3B8] border border-[#334155]'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  asm?.band === 'strong' ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]' :
                  asm?.band === 'promising' ? 'bg-sky-400 shadow-[0_0_8px_#38BDF8]' :
                  asm?.band === 'early' ? 'bg-amber-400' :
                  'bg-[#64748B]'
                }`} />
                {asm?.band || 'unscored'}
              </span>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-[#1E293B] text-xs">
            <div>
              <span className="text-[#64748B] block text-[10px] uppercase font-bold">Location</span>
              <span className="text-white font-medium mt-0.5 block">{candidate.district} · {candidate.block}</span>
            </div>
            <div>
              <span className="text-[#64748B] block text-[10px] uppercase font-bold">Persona</span>
              <span className="text-white font-medium mt-0.5 block capitalize">{candidate.persona}</span>
            </div>
            <div>
              <span className="text-[#64748B] block text-[10px] uppercase font-bold">Declared Stage</span>
              <span className="text-white font-medium mt-0.5 block capitalize">{candidate.declaredStage}</span>
            </div>
            <div>
              <span className="text-[#64748B] block text-[10px] uppercase font-bold">Model Checkpoint</span>
              <span className="text-white font-medium mt-0.5 block truncate">
                {layaRun?.modelCheckpoint || 'convaiinnovations/laya-default'}
              </span>
            </div>
          </div>

          {/* Capped By or Flags Banners */}
          {asm?.cappedBy && (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2 text-xs text-amber-300">
              <span className="font-bold">⚠️ Band Capped:</span>
              <span>Constrained by <strong className="text-white">{asm.cappedBy}</strong></span>
            </div>
          )}

          {flags.length > 0 && (
            <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex flex-col gap-1 text-xs text-rose-300">
              <span className="font-bold">🚨 Detected Anomalies / Flags:</span>
              <ul className="list-disc list-inside text-rose-200">
                {flags.map((f, idx) => (
                  <li key={idx}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Fits & Model Answers Deep-Dive */}
        <section>
          <div className="flex items-center justify-between mb-3 font-mono">
            <h2 className="text-sm uppercase tracking-wider text-[#94A3B8] font-bold">
              Tri-Fit Evaluations (Click to inspect questions)
            </h2>
            <span className="text-xs text-[#64748B]">Deterministic Laya Scoring</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FitCard 
              title="Founder-Problem" 
              score={asm?.founderProblem ?? null} 
              confidence={asm?.confidence}
              questions={founderProblemQuestions}
            />
            <FitCard 
              title="Problem-Solution" 
              score={asm?.problemSolution ?? null} 
              confidence={asm?.confidence}
              questions={problemSolutionQuestions}
            />
            <FitCard 
              title="Solution-Market" 
              score={asm?.solutionMarket ?? null} 
              confidence={asm?.confidence}
              questions={solutionMarketQuestions}
            />
          </div>
        </section>

        {/* Dossier Inspector */}
        <section className="bg-[#0F172A] border border-[#1E293B] rounded-xl overflow-hidden shadow-sm font-mono">
          <div className="p-4 bg-[#111827] border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xs uppercase tracking-wider text-white font-bold flex items-center gap-2">
                <span>Dossier Payload (Identity-Stripped Sent to Laya)</span>
              </h2>
              <span className="text-[11px] text-[#64748B]">Strict 400-token budget · Decisive order</span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-[#94A3B8]">
                <span>Tokens:</span>
                <span className={`font-bold ${approxTokens > 400 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  ~{approxTokens}
                </span>
                <span className="text-[#64748B]">/ 400</span>
              </div>
              <div className="w-16 bg-[#1E293B] h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${approxTokens > 400 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                  style={{ width: `${Math.min((approxTokens / 400) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <pre className="p-4 text-emerald-400 text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-72 bg-[#090D16]">
            {dossier ? JSON.stringify(dossierJson, null, 2) : '// No dossier recorded'}
          </pre>
        </section>

        {/* Raw Responses Audit Grid */}
        <section className="bg-[#0F172A] border border-[#1E293B] rounded-xl overflow-hidden shadow-sm font-mono mb-16">
          <div className="p-4 bg-[#111827] border-b border-[#1E293B]">
            <h2 className="text-xs uppercase tracking-wider text-white font-bold">
              Raw Founder Questionnaire Audit
            </h2>
            <p className="text-[11px] text-[#64748B]">
              Unfiltered intake inputs ({candidate.responses.length} captured fields)
            </p>
          </div>

          <div className="divide-y divide-[#1E293B]">
            {candidate.responses.map((r: any) => (
              <div key={r.id} className="p-3.5 hover:bg-[#1E293B]/40 transition-colors flex flex-col sm:flex-row sm:items-start gap-2 text-xs">
                <span className="w-48 flex-shrink-0 text-[#64748B] font-semibold uppercase text-[10px] pt-0.5">
                  {r.fieldId}
                </span>
                <span className="text-white font-sans flex-1 leading-relaxed">
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Sticky Reviewer Action Bar */}
        <ReviewerActionBar 
          candidateId={candidate.id} 
          currentDecision={asm?.reviewerDecision || null} 
        />
      </div>
    </div>
  )
}
