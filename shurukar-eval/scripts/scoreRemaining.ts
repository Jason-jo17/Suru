import { prisma } from '../src/lib/db'
import { runPipelineForCandidate } from '../src/lib/pipeline'

async function main() {
  const all = await prisma.candidate.findMany({
    select: { id: true, externalId: true },
    orderBy: { createdAt: 'asc' },
  })

  const scoredRuns = await prisma.layaRun.findMany({
    where: { status: 'scored' },
    select: { dossier: { select: { candidateId: true } } },
  })

  const scoredIds = new Set(scoredRuns.map((r) => r.dossier.candidateId))
  const remaining = all.filter((c) => !scoredIds.has(c.id))

  console.log(`Total candidates: ${all.length}`)
  console.log(`Already scored: ${scoredIds.size}`)
  console.log(
    `Remaining to score (${remaining.length}): ${remaining.map((c) => c.externalId).join(', ')}\n`
  )

  for (let i = 0; i < remaining.length; i++) {
    const candidate = remaining[i]
    console.log(`[${i + 1}/${remaining.length}] Scoring ${candidate.externalId}...`)
    const start = Date.now()
    try {
      const asm = await runPipelineForCandidate(candidate.id)
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      console.log(
        `  ✓ ${candidate.externalId.padEnd(20)} ${asm.scenario} band: ${asm.band.padEnd(10)} ` +
          `FP: ${String(asm.founderProblem).padStart(3)} PS: ${String(asm.problemSolution).padStart(3)} ` +
          `SM: ${String(asm.solutionMarket).padStart(3)} comp: ${String(asm.composite).padStart(3)} ` +
          `conf: ${asm.confidence?.toFixed(2) ?? ' --'} (${elapsed}s)\n`
      )
    } catch (err) {
      console.error(`  ✗ Error scoring ${candidate.externalId}:`, (err as Error).message)
    }
  }

  console.log('Finished scoring remaining candidates!')
}

main()
  .catch((err) => {
    console.error('Pipeline error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect().then(() => process.exit(0)))
