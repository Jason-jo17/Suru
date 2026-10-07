import { prisma } from '../src/lib/db'
import { runPipelineForCandidate } from '../src/lib/pipeline'

async function main() {
  const cands = await prisma.candidate.findMany()
  console.log(`Running pipeline for ${cands.length} candidates...`)
  
  let success = 0
  for (const c of cands) {
    try {
      await runPipelineForCandidate(c.id)
      success++
      console.log(`Successfully scored candidate ${c.externalId}`)
    } catch (e) {
      console.error(`Failed on candidate ${c.externalId}:`, (e as Error).message)
    }
  }
  
  console.log(`Pipeline completed for ${success}/${cands.length} candidates.`)
}

main().catch(console.error)
