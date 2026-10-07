import { prisma } from '../src/lib/db'
import { health, whoami } from '../src/lib/laya/client'
import { questionSetVersion } from '../src/lib/laya/questionSets'
import { runPipelineForCohort } from '../src/lib/pipeline'

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))

  if (!process.env.LAYA_API_KEY) {
    console.warn(
      'LAYA_API_KEY is not set. The pipeline will still run end to end and every\n' +
        'candidate will land `unscored` — which is the correct, visible state.\n',
    )
  } else {
    const [h, w] = await Promise.all([health(), whoami()])
    console.log(`laya health: ${h.ok ? 'ok' : `unavailable (${h.error})`}`)
    console.log(`laya whoami: ${w.ok ? JSON.stringify(w.body) : `unavailable (${w.error})`}\n`)
  }

  const candidates = await prisma.candidate.findMany({
    where: only.length > 0 ? { externalId: { in: only } } : undefined,
    select: { id: true, externalId: true },
  })

  console.log(`Question set version: ${questionSetVersion()}`)
  console.log(`Running pipeline for ${candidates.length} candidates...\n`)

  const assessments = await runPipelineForCohort(candidates.map((c) => c.id))
  const byId = new Map(candidates.map((c) => [c.id, c.externalId]))

  const counts: Record<string, number> = {}
  for (const a of assessments) {
    counts[a.band] = (counts[a.band] ?? 0) + 1
    const flags = JSON.parse(a.flags) as string[]
    console.log(
      `  ${(byId.get(a.candidateId) ?? a.candidateId).padEnd(16)} ${a.scenario}  ` +
        `${a.band.padEnd(10)} fits ${[a.founderProblem, a.problemSolution, a.solutionMarket]
          .map((v) => (v === null ? ' --' : String(v).padStart(3)))
          .join(' ')}` +
        `  conf ${a.confidence === null ? ' -- ' : a.confidence.toFixed(2)}` +
        `${a.cappedBy ? `  capped: ${a.cappedBy}` : ''}` +
        `${flags.length ? `  flags: ${flags.join(', ')}` : ''}`,
    )
  }

  console.log(
    `\n${assessments.length} assessments: ` +
      Object.entries(counts)
        .map(([band, n]) => `${n} ${band}`)
        .join(', '),
  )
}

main()
  .catch((err) => {
    console.error(`\nPipeline failed: ${(err as Error).message}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
