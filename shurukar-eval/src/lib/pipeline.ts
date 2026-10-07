import { buildDossier } from './distil/buildDossier'
import { scoreDossier } from './laya/client'
import { assembleAssessment } from './assemble/scorer'

export async function runPipelineForCandidate(candidateId: string) {
  // 1. Distil
  const dossier = await buildDossier(candidateId)
  
  // 2. Score with Laya
  const run = await scoreDossier(dossier.id)
  
  // 3. Assemble Assessment
  const assessment = await assembleAssessment(run.id)
  
  return assessment
}
