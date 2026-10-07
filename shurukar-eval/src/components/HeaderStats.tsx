import { prisma } from '@/lib/db'

export default async function HeaderStats() {
  const totalCandidates = await prisma.candidate.count()
  
  const assessments = await prisma.assessment.findMany({
    select: {
      band: true,
      flags: true,
      reviewerDecision: true
    }
  })

  let scoredCount = 0
  let unscoredCount = 0
  let strongCount = 0
  let promisingCount = 0
  let earlyCount = 0
  let flaggedCount = 0
  let reviewedCount = 0

  assessments.forEach(a => {
    if (a.band && a.band !== 'unscored') {
      scoredCount++
      if (a.band === 'strong') strongCount++
      else if (a.band === 'promising') promisingCount++
      else if (a.band === 'early') earlyCount++
    } else {
      unscoredCount++
    }

    try {
      const flags = JSON.parse(a.flags || '[]')
      if (flags.length > 0) flaggedCount++
    } catch {}

    if (a.reviewerDecision) {
      reviewedCount++
    }
  })

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-6 p-3 bg-[#0F172A] border border-[#1E293B] rounded-lg shadow-sm font-mono text-xs">
      <div className="flex flex-col border-r border-[#1E293B] pr-3">
        <span className="text-[#64748B] uppercase tracking-wider text-[10px]">Cohort Total</span>
        <span className="text-lg font-bold text-white mt-0.5">{totalCandidates}</span>
      </div>

      <div className="flex flex-col border-r border-[#1E293B] pr-3">
        <span className="text-[#64748B] uppercase tracking-wider text-[10px]">Scored / Unscored</span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-emerald-400 font-bold">{scoredCount}</span>
          <span className="text-[#64748B]">/</span>
          <span className="text-[#94A3B8] font-bold">{unscoredCount}</span>
        </div>
      </div>

      <div className="flex flex-col border-r border-[#1E293B] pr-3">
        <span className="text-[#64748B] uppercase tracking-wider text-[10px]">Bands (S · P · E)</span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-emerald-400 font-semibold">{strongCount}</span>
          <span className="text-[#64748B]">·</span>
          <span className="text-sky-400 font-semibold">{promisingCount}</span>
          <span className="text-[#64748B]">·</span>
          <span className="text-amber-400 font-semibold">{earlyCount}</span>
        </div>
      </div>

      <div className="flex flex-col border-r border-[#1E293B] pr-3">
        <span className="text-[#64748B] uppercase tracking-wider text-[10px]">Anomalies / Flags</span>
        <span className={`text-lg font-bold mt-0.5 ${flaggedCount > 0 ? 'text-rose-400' : 'text-[#94A3B8]'}`}>
          {flaggedCount}
        </span>
      </div>

      <div className="flex flex-col border-r border-[#1E293B] pr-3">
        <span className="text-[#64748B] uppercase tracking-wider text-[10px]">Review Status</span>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-white font-bold">{reviewedCount}</span>
          <span className="text-[#64748B]">/</span>
          <span className="text-[#64748B]">{totalCandidates}</span>
        </div>
      </div>

      <div className="flex flex-col justify-center pl-1">
        <span className="text-[#64748B] uppercase tracking-wider text-[10px]">Coverage</span>
        <div className="w-full bg-[#1E293B] h-1.5 rounded-full mt-1.5 overflow-hidden">
          <div 
            className="bg-sky-400 h-full rounded-full transition-all duration-300" 
            style={{ width: `${totalCandidates > 0 ? (reviewedCount / totalCandidates) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  )
}
