import { prisma } from '../db'
import { assertAllMapped, fieldMap } from './fieldMap'

export async function ingestCandidate(record: Record<string, string>, externalId: string) {
  const headers = Object.keys(record)
  assertAllMapped(headers)

  const declaredStage = record['declared_stage'] || 'idea'
  const district = record['district'] || 'Unknown'
  const block = record['block'] || 'Unknown'
  const persona = record['persona'] || 'other'
  const language = record['language'] || 'unknown'

  const candidate = await prisma.candidate.upsert({
    where: { externalId },
    update: {
      declaredStage,
      district,
      block,
      persona,
      language
    },
    create: {
      externalId,
      declaredStage,
      district,
      block,
      persona,
      language
    }
  })

  // Upsert raw responses
  for (const [key, value] of Object.entries(record)) {
    if (key === '_expected') continue
    const fieldId = fieldMap[key]
    if (!fieldId) continue

    const existing = await prisma.rawResponse.findFirst({
      where: { candidateId: candidate.id, fieldId }
    })
    
    if (existing) {
      if (existing.value !== value) {
        await prisma.rawResponse.update({
          where: { id: existing.id },
          data: { value }
        })
      }
    } else {
      await prisma.rawResponse.create({
        data: {
          candidateId: candidate.id,
          fieldId,
          value
        }
      })
    }
  }

  return candidate
}
