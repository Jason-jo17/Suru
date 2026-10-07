import { prisma } from '@/lib/db'
import Link from 'next/link'
import Filters from '@/components/Filters'
import HeaderStats from '@/components/HeaderStats'

export default async function CandidatesPage(props: { searchParams: Promise<Record<string, string>> }) {
  const searchParams = await props.searchParams
  const where: any = {}

  if (searchParams.district) {
    where.OR = [
      { district: { contains: searchParams.district } },
      { block: { contains: searchParams.district } },
      { externalId: { contains: searchParams.district } }
    ]
  }
  if (searchParams.stage) where.declaredStage = searchParams.stage
  if (searchParams.persona) where.persona = searchParams.persona
  if (searchParams.language) where.language = searchParams.language

  const asmWhere: any = {}
  if (searchParams.band) asmWhere.band = searchParams.band
  if (searchParams.reviewerStatus) {
    if (searchParams.reviewerStatus === 'unreviewed') asmWhere.reviewerDecision = null
    else asmWhere.reviewerDecision = searchParams.reviewerStatus
  }
  if (searchParams.unscored === 'true') asmWhere.band = 'unscored'
  if (searchParams.hasFlags === 'true') asmWhere.flags = { not: "[]" }

  if (Object.keys(asmWhere).length > 0) {
    where.assessments = { some: asmWhere }
  }

  const page = parseInt(searchParams.page || '1', 10)
  const take = 50
  const skip = (page - 1) * take

  const sort = searchParams.sort || 'date_desc'
  let orderBy: any = { createdAt: 'desc' }
  if (sort === 'date_asc') orderBy = { createdAt: 'asc' }

  const [candidates, totalCount] = await Promise.all([
    prisma.candidate.findMany({
      where,
      include: {
        assessments: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy,
      skip,
      take
    }),
    prisma.candidate.count({ where })
  ])

  const totalPages = Math.ceil(totalCount / take) || 1

  return (
    <div className="min-h-screen bg-[#090D16] text-[#F8FAFC] p-4 md:p-8 flex flex-col">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
            <h1 className="text-xl md:text-2xl font-black tracking-tight font-sans">
              ShuruKar Evaluation Workbench
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1E293B] text-[#94A3B8] border border-[#334155]">
              v1.2 · Sheets Edition
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5 font-mono">
            High-density founder evaluation, Laya model scoring & cohort triage
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-[#64748B]">Navigation:</span>
          <kbd>J</kbd>
          <kbd>K</kbd>
          <span className="text-[#64748B] ml-1">Search:</span>
          <kbd>/</kbd>
        </div>
      </div>

      {/* Cohort Stats Ribbon */}
      <HeaderStats />

      {/* Filters Ribbon */}
      <Filters />

      {/* High-Density Spreadsheet Table */}
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-lg overflow-hidden shadow-lg flex-1 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-[#111827] border-b border-[#1E293B] text-[#64748B] uppercase tracking-wider text-[11px] select-none">
                <th className="py-2.5 px-3 w-10 text-center border-r border-[#1E293B]">#</th>
                <th className="py-2.5 px-3 border-r border-[#1E293B]">Candidate Identifier</th>
                <th className="py-2.5 px-3 border-r border-[#1E293B]">Location</th>
                <th className="py-2.5 px-3 border-r border-[#1E293B]">Persona</th>
                <th className="py-2.5 px-3 border-r border-[#1E293B]">Stage</th>
                <th className="py-2.5 px-3 border-r border-[#1E293B]">Fits (FP · PS · SM)</th>
                <th className="py-2.5 px-3 border-r border-[#1E293B]">Band</th>
                <th className="py-2.5 px-3 border-r border-[#1E293B] text-center">Flags</th>
                <th className="py-2.5 px-3 border-r border-[#1E293B]">Decision</th>
                <th className="py-2.5 px-3 w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {candidates.map((c: any, idx: number) => {
                const asm = c.assessments[0]
                let flags: string[] = []
                try {
                  flags = asm ? JSON.parse(asm.flags) : []
                } catch {}

                const rowNum = skip + idx + 1

                return (
                  <tr 
                    key={c.id} 
                    className="hover:bg-[#1E293B]/70 transition-colors group cursor-pointer"
                  >
                    {/* Row Index */}
                    <td className="py-2 px-3 text-center text-[#64748B] border-r border-[#1E293B] text-[11px]">
                      {rowNum}
                    </td>

                    {/* External ID */}
                    <td className="py-2 px-3 border-r border-[#1E293B] font-semibold text-sky-400 group-hover:text-sky-300">
                      <Link href={`/candidates/${c.id}`} className="hover:underline flex items-center gap-1.5">
                        <span>{c.externalId}</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-[#64748B]">↗</span>
                      </Link>
                    </td>

                    {/* District & Block */}
                    <td className="py-2 px-3 border-r border-[#1E293B] text-[#94A3B8]">
                      <span>{c.district}</span>
                      {c.block && <span className="text-[#64748B]"> · {c.block}</span>}
                    </td>

                    {/* Persona */}
                    <td className="py-2 px-3 border-r border-[#1E293B]">
                      <span className="px-1.5 py-0.5 rounded bg-[#1E293B] text-[#CBD5E1] text-[10px] border border-[#334155]/50">
                        {c.persona || 'unknown'}
                      </span>
                    </td>

                    {/* Stage */}
                    <td className="py-2 px-3 border-r border-[#1E293B]">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        c.declaredStage === 'in_market' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        c.declaredStage === 'built' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {c.declaredStage || 'idea'}
                      </span>
                    </td>

                    {/* Mini Fit Scores */}
                    <td className="py-2 px-3 border-r border-[#1E293B]">
                      {asm && asm.band !== 'unscored' ? (
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className={`${asm.founderProblem >= 50 ? 'text-emerald-400' : 'text-[#94A3B8]'}`}>
                            {asm.founderProblem ?? '-'}
                          </span>
                          <span className="text-[#64748B]">·</span>
                          <span className={`${asm.problemSolution >= 50 ? 'text-emerald-400' : 'text-[#94A3B8]'}`}>
                            {asm.problemSolution ?? '-'}
                          </span>
                          <span className="text-[#64748B]">·</span>
                          <span className={`${asm.solutionMarket >= 50 ? 'text-emerald-400' : 'text-[#94A3B8]'}`}>
                            {asm.solutionMarket ?? '-'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#64748B] text-[10px] italic">unscored</span>
                      )}
                    </td>

                    {/* Band Badge */}
                    <td className="py-2 px-3 border-r border-[#1E293B]">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        asm?.band === 'strong' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                        asm?.band === 'promising' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30' :
                        asm?.band === 'early' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                        'bg-[#1E293B] text-[#94A3B8] border border-[#334155]'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          asm?.band === 'strong' ? 'bg-emerald-400 shadow-[0_0_6px_#10B981]' :
                          asm?.band === 'promising' ? 'bg-sky-400 shadow-[0_0_6px_#38BDF8]' :
                          asm?.band === 'early' ? 'bg-amber-400' :
                          'bg-[#64748B]'
                        }`} />
                        {asm?.band || 'unscored'}
                      </span>
                    </td>

                    {/* Flags */}
                    <td className="py-2 px-3 border-r border-[#1E293B] text-center">
                      {flags.length > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 font-bold text-[10px]">
                          {flags.length}
                        </span>
                      ) : (
                        <span className="text-[#475569]">0</span>
                      )}
                    </td>

                    {/* Reviewer Status */}
                    <td className="py-2 px-3 border-r border-[#1E293B]">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        asm?.reviewerDecision === 'advance' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        asm?.reviewerDecision === 'hold' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        asm?.reviewerDecision === 'needs_info' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                        'text-[#64748B]'
                      }`}>
                        {asm?.reviewerDecision ? asm.reviewerDecision.replace('_', ' ') : 'unreviewed'}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-2 px-3 text-center">
                      <Link 
                        href={`/candidates/${c.id}`} 
                        className="px-2 py-1 rounded bg-[#1E293B] hover:bg-sky-500 hover:text-[#090D16] transition-colors text-white font-bold"
                      >
                        →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {candidates.length === 0 && (
            <div className="py-12 text-center text-[#64748B] font-mono text-xs">
              <p className="text-base text-[#94A3B8] font-bold mb-1">No matching candidates found</p>
              <p>Try broadening your filters or resetting the search criteria.</p>
            </div>
          )}
        </div>

        {/* Spreadsheet Footer / Pagination */}
        <div className="p-3 bg-[#111827] border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
          <div className="text-[#64748B]">
            Showing <span className="text-white font-bold">{candidates.length}</span> of <span className="text-white font-bold">{totalCount}</span> rows · Page <span className="text-white font-bold">{page}</span> of <span className="text-white font-bold">{totalPages}</span>
          </div>

          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link 
                href={`/candidates?page=${page - 1}`} 
                className="px-2.5 py-1 bg-[#1E293B] hover:bg-[#334155] text-white rounded border border-[#334155] transition-colors"
              >
                ← Prev
              </Link>
            )}
            {page < totalPages && (
              <Link 
                href={`/candidates?page=${page + 1}`} 
                className="px-2.5 py-1 bg-[#1E293B] hover:bg-[#334155] text-white rounded border border-[#334155] transition-colors"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
