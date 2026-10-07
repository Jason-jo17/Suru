import { prisma } from './db'
import type { SeedBankRecord } from '@prisma/client'

/**
 * The SEED Bank.
 *
 * A founder who answered through the router and stopped is still someone the
 * programme knows something about and can act on. Their record is built at
 * ingest from the raw answers, so it exists whether or not they are ever
 * scored, and it never depends on Laya being up.
 */

/** The four fields a record needs to be useful to the programme. */
export const REQUIRED_FIELDS = ['aspiration', 'block', 'status', 'constraintType'] as const

export interface SeedBankInput {
  aspiration?: string | null
  block?: string | null
  status?: string | null
  constraintType?: string | null
  persona?: string | null
  declaredStage?: string | null
  district?: string | null
}

function clean(value: string | null | undefined): string | null {
  const v = (value ?? '').trim()
  return v === '' ? null : v
}

export function evaluateCompleteness(input: SeedBankInput): {
  complete: boolean
  missing: string[]
} {
  const values: Record<string, string | null> = {
    aspiration: clean(input.aspiration),
    block: clean(input.block),
    status: clean(input.status),
    constraintType: clean(input.constraintType),
  }
  const missing = REQUIRED_FIELDS.filter((f) => values[f] === null)
  return { complete: missing.length === 0, missing: [...missing] }
}

/** Builds the SEED Bank input from raw answers keyed by stable fieldId. */
export function seedBankFromAnswers(
  answers: Record<string, string>,
  candidate: { block?: string | null; district?: string | null; persona?: string | null; declaredStage?: string | null },
): SeedBankInput {
  return {
    aspiration: answers.aspiration ?? answers.growth_ambition ?? null,
    block: answers.block ?? candidate.block ?? null,
    status: answers.registration_status ?? null,
    constraintType: answers.constraint ?? null,
    persona: answers.persona ?? candidate.persona ?? null,
    declaredStage: answers.declared_stage ?? candidate.declaredStage ?? null,
    district: answers.district ?? candidate.district ?? null,
  }
}

export async function upsertSeedBankRecord(
  candidateId: string,
  input: SeedBankInput,
): Promise<SeedBankRecord> {
  const { complete, missing } = evaluateCompleteness(input)
  const data = {
    aspiration: clean(input.aspiration),
    block: clean(input.block),
    status: clean(input.status),
    constraintType: clean(input.constraintType),
    persona: clean(input.persona),
    declaredStage: clean(input.declaredStage),
    district: clean(input.district),
    complete,
    missingFields: JSON.stringify(missing),
  }

  return prisma.seedBankRecord.upsert({
    where: { candidateId },
    update: data,
    create: { candidateId, ...data },
  })
}
