import { prisma } from '../src/lib/db'
import { assemble } from '../src/lib/assemble/scorer'
import type { Scenario } from '../src/lib/route'

async function main() {
  const scoredRuns = await prisma.layaRun.findMany({
    where: { status: 'scored' },
    include: { dossier: { include: { candidate: true } } },
  })
  console.log(`Scored runs count: ${scoredRuns.length}`)
  for (const r of scoredRuns) {
    const answers = JSON.parse(r.answers)
    const res = assemble(answers, r.scenario as Scenario, {})
    console.log(
      `${r.dossier.candidate.externalId.padEnd(25)} band: ${res.band.padEnd(10)} FP: ${String(res.founderProblem).padStart(3)} PS: ${String(res.problemSolution).padStart(3)} SM: ${String(res.solutionMarket).padStart(3)} comp: ${String(res.composite).padStart(3)} flags: ${res.flags.join(', ')}`
    )
  }
}

main()
  .catch((err) => console.error(err))
  .finally(() => prisma.$disconnect().then(() => process.exit(0)))
