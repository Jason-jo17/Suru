import { prisma } from '../db'

const DECISIVE_ORDER = [
  'problem_solution',
  'who_will_use',
  'founder_proximity',
  'inspiration',
  'alternatives_today',
  'validation_done',
  'users_count',
  'paying_customers',
  'monthly_income',
  'willingness_to_pay',
  'route_to_market',
  'access_route',
  'constraint',
  'declared_stage',
  'purpose',
  'aspiration',
  'growth_ambition',
  'prior_venture_closed',
  'time_in_line',
  'retention_signal',
  'time_commitment',
  'team_size',
  'commitment_type',
  'registration_status',
]

function stripIdentity(value: string) {
  return value
}

export async function buildDossier(candidateId: string) {
  const responses = await prisma.rawResponse.findMany({
    where: { candidateId }
  })
  
  const map: Record<string, string> = {}
  for (const r of responses) {
    if (r.value.trim() !== '') {
      map[r.fieldId] = r.value
    }
  }

  const payload: Record<string, string> = {}
  let tokenCount = 0

  for (const field of DECISIVE_ORDER) {
    if (map[field]) {
      const val = stripIdentity(map[field])
      const words = val.split(/\s+/).length
      const tokens = Math.ceil(words * 1.3)
      
      const isTop5 = DECISIVE_ORDER.indexOf(field) < 5
      
      if (!isTop5 && tokenCount + tokens > 400) {
        continue
      }

      payload[field] = val
      tokenCount += tokens
    }
  }

  const distillerVersion = 'v1.0'
  const version = 1

  const dossier = await prisma.dossier.upsert({
    where: { candidateId_version: { candidateId, version } },
    update: {
      payload: JSON.stringify(payload),
      tokenCount,
      distillerVersion
    },
    create: {
      candidateId,
      version,
      payload: JSON.stringify(payload),
      tokenCount,
      distillerVersion
    }
  })

  return dossier
}
