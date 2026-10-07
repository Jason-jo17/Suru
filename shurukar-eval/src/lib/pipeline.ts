import { prisma } from './db'
import type { Assessment } from '@prisma/client'
import { assembleAssessment } from './assemble/scorer'
import { buildDossier } from './distil/buildDossier'
import {
  MAX_BATCH,
  callSystemOneBatch,
  checkpointFor,
  persistLayaRun,
  scoreDossier,
} from './laya/client'
import { questionSetFor } from './laya/questionSets'
import { routeCandidate, type Scenario } from './route'
import { seedBankFromAnswers, upsertSeedBankRecord } from './seedbank'

/**
 * The pipeline, callable from a CLI script and from a route, so it can be
 * re-run over stored data without the UI.
 *
 * Stage 3 is the only stage that calls a model, and the only one allowed to be
 * slow or to fail. A failure there produces an `unscored` assessment and the
 * run continues — it never aborts the cohort.
 */

async function rawAnswersFor(candidateId: string): Promise<Record<string, string>> {
  const responses = await prisma.rawResponse.findMany({ where: { candidateId } })
  const answers: Record<string, string> = {}
  for (const r of responses) {
    if (r.value?.trim()) answers[r.fieldId] = r.value
  }
  return answers
}

/** Refreshes the SEED Bank record from stored answers. Never touches Laya. */
export async function refreshSeedBank(candidateId: string): Promise<void> {
  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
  if (!candidate) return
  const answers = await rawAnswersFor(candidateId)
  await upsertSeedBankRecord(candidateId, seedBankFromAnswers(answers, candidate))
}

export async function runPipelineForCandidate(candidateId: string): Promise<Assessment> {
  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
  if (!candidate) throw new Error(`Candidate not found: ${candidateId}`)

  const answers = await rawAnswersFor(candidateId)
  const routing = routeCandidate(answers, candidate.declaredStage)

  await refreshSeedBank(candidateId)

  const dossier = await buildDossier(candidateId)
  const run = await scoreDossier(dossier.id, {
    scenario: routing.scenario,
    routingFlags: routing.flags,
  })
  return assembleAssessment(run.id)
}

interface CohortMember {
  candidateId: string
  dossierId: string
  state: Record<string, string>
  scenario: Scenario
  checkpoint: string
  routingFlags: string[]
}

/**
 * Scores a whole cohort. States are grouped by question set and checkpoint —
 * the only two things that must match inside a batch — and sent up to
 * MAX_BATCH at a time, which is the cheap path and the right answer to a 429.
 */
export async function runPipelineForCohort(
  candidateIds: string[],
  opts: { onProgress?: (done: number, total: number) => void } = {},
): Promise<Assessment[]> {
  const members: CohortMember[] = []

  for (const candidateId of candidateIds) {
    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    if (!candidate) continue

    const answers = await rawAnswersFor(candidateId)
    const routing = routeCandidate(answers, candidate.declaredStage)
    await refreshSeedBank(candidateId)

    const dossier = await buildDossier(candidateId)
    members.push({
      candidateId,
      dossierId: dossier.id,
      state: JSON.parse(dossier.payload) as Record<string, string>,
      scenario: routing.scenario,
      checkpoint: checkpointFor(candidate.language),
      routingFlags: routing.flags,
    })
  }

  const groups = new Map<string, CohortMember[]>()
  for (const m of members) {
    const key = `${m.scenario}::${m.checkpoint}`
    const existing = groups.get(key)
    if (existing) existing.push(m)
    else groups.set(key, [m])
  }

  const assessments: Assessment[] = []
  let done = 0

  for (const group of groups.values()) {
    const questions = questionSetFor(group[0].scenario)

    for (let i = 0; i < group.length; i += MAX_BATCH) {
      const chunk = group.slice(i, i + MAX_BATCH)
      const outcomes = await callSystemOneBatch(
        chunk.map((m) => m.state),
        questions,
        chunk[0].checkpoint,
      )

      for (let j = 0; j < chunk.length; j++) {
        const member = chunk[j]
        const run = await persistLayaRun({
          dossierId: member.dossierId,
          scenario: member.scenario,
          modelCheckpoint: member.checkpoint,
          questions,
          routingFlags: member.routingFlags,
          outcome: outcomes[j],
        })
        assessments.push(await assembleAssessment(run.id))
        done++
        opts.onProgress?.(done, members.length)
      }
    }
  }

  return assessments
}

export async function runPipelineForAll(
  opts: { onProgress?: (done: number, total: number) => void } = {},
): Promise<Assessment[]> {
  const candidates = await prisma.candidate.findMany({ select: { id: true } })
  return runPipelineForCohort(
    candidates.map((c) => c.id),
    opts,
  )
}
