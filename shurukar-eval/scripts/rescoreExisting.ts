import { prisma } from '../src/lib/db'
import { assembleAssessment } from '../src/lib/assemble/scorer'

async function main() {
  const scoredRuns = await prisma.layaRun.findMany({
    where: { status: 'scored' },
    include: { dossier: { include: { candidate: true } } },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Re-assembling ${scoredRuns.length} scored Laya runs...`)
  for (const run of scoredRuns) {
    const asm = await assembleAssessment(run.id)
    console.log(
      `✓ ${run.dossier.candidate.externalId.padEnd(25)} band: ${asm.band.padEnd(10)} FP: ${String(asm.founderProblem).padStart(3)} PS: ${String(asm.problemSolution).padStart(3)} SM: ${String(asm.solutionMarket).padStart(3)} comp: ${String(asm.composite).padStart(3)}`
    )
  }
}

main()
  .catch((err) => {
    console.error('Error re-scoring:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect().then(() => process.exit(0)))
