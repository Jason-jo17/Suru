import { prisma } from '../db'
import type { Candidate } from '@prisma/client'
import { assertAllMapped, extractMeta, normalizeRecord } from './fieldMap'
import { seedBankFromAnswers, upsertSeedBankRecord } from '../seedbank'

/**
 * Stage 1 — ingest.
 *
 * Headers are validated against the field map before anything is written: an
 * unmapped column is data loss that looks exactly like an unanswered question,
 * so it stops the import rather than being skipped.
 */

export interface IngestResult {
  candidate: Candidate
  fieldsStored: number
  seedBankComplete: boolean
}

function deriveExternalId(
  record: Record<string, string>,
  meta: Record<string, string>,
  index: number,
): string {
  const declared = (meta.external_id || '').trim()
  if (declared) return declared
  const name = (record.name || '').trim()
  if (name) return `${name.replace(/\s+/g, '-').toLowerCase()}-${index}`
  return `cand-${index}`
}

export async function ingestCandidate(
  rawRecord: Record<string, string>,
  index: number,
  opts: { externalId?: string } = {},
): Promise<IngestResult> {
  assertAllMapped(Object.keys(rawRecord))

  const answers = normalizeRecord(rawRecord)
  const meta = extractMeta(rawRecord)
  const externalId = opts.externalId || deriveExternalId(answers, meta, index)

  const consentRaw = (meta.consent_at || '').trim()
  const consentAt = consentRaw ? new Date(consentRaw) : null

  const profile = {
    district: answers.district?.trim() || 'Unknown',
    block: answers.block?.trim() || 'Unknown',
    persona: answers.persona?.trim() || 'other',
    declaredStage: answers.declared_stage?.trim() || 'idea',
    language: (meta.language || 'unknown').trim().toLowerCase() || 'unknown',
    consentAt: consentAt && !Number.isNaN(consentAt.getTime()) ? consentAt : null,
  }

  const candidate = await prisma.candidate.upsert({
    where: { externalId },
    update: profile,
    create: { externalId, ...profile },
  })

  // Raw answers are replaced wholesale, so a re-import of a corrected export
  // cannot leave a stale answer behind beside the new one.
  await prisma.rawResponse.deleteMany({ where: { candidateId: candidate.id } })
  const rows = Object.entries(answers)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([fieldId, value]) => ({ candidateId: candidate.id, fieldId, value: String(value) }))
  if (rows.length > 0) await prisma.rawResponse.createMany({ data: rows })

  // The SEED Bank record is written here, not in the pipeline: it must survive
  // a founder who stopped answering and a model that is down.
  const seed = await upsertSeedBankRecord(
    candidate.id,
    seedBankFromAnswers(answers, candidate),
  )

  return { candidate, fieldsStored: rows.length, seedBankComplete: seed.complete }
}
