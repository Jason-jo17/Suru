/**
 * Provenance marking.
 *
 * Where a question asks the model to *compare* something, the value has to say
 * where it came from, otherwise a founder's claim and a verified market figure
 * read identically. This is a statement about the source, not a rating.
 */

/** Values that are the founder's own unverified assertion. */
export const CLAIMED_FIELDS = new Set([
  'users_count',
  'paying_customers',
  'monthly_income',
  'retention_signal',
  'willingness_to_pay',
  'customers_spoken_to',
])

export function markClaimed(value: string): string {
  return `CLAIMED: ${value}`
}

export function markVerified(value: string, asOf: string, source: string): string {
  return `VERIFIED ${asOf}: ${value} (${source})`
}

interface MarketFact {
  /** Lowercased keywords that must appear in the founder's own text. */
  match: string[]
  value: string
  source: string
  asOf: string
}

/**
 * Verified market figures, used only to give the model a yardstick for the
 * sector the founder is actually in. Deliberately small and dated: a stale
 * figure presented as current is worse than no figure.
 */
export const MARKET_FACTS: MarketFact[] = [
  {
    match: ['pharmacy', 'pharmacies', 'chemist', 'medical store', 'davakhana', 'दवा', 'दवाख़ाना', 'दवाखाना', 'मेडिकल'],
    value: '~8.5 lakh retail pharmacies in India',
    source: 'AIOCD',
    asOf: '2026-10',
  },
  {
    match: ['kirana', 'grocery', 'general store', 'provision store', 'किराना', 'परचून', 'दुकान'],
    value: '~1.3 crore kirana stores in India',
    source: 'FICCI retail estimate',
    asOf: '2026-10',
  },
  {
    match: ['dairy', 'milk', 'doodh', 'डेयरी', 'दूध'],
    value: 'India produces ~230 million tonnes of milk a year, ~70% handled informally',
    source: 'NDDB',
    asOf: '2026-10',
  },
  {
    match: ['tailor', 'tailoring', 'silai', 'boutique', 'सिलाई', 'दर्जी', 'कपड़े'],
    value: '~45 lakh people in tailoring and garment-making micro-units',
    source: 'NSSO unincorporated enterprises survey',
    asOf: '2026-10',
  },
  {
    match: ['coaching', 'tuition', 'student hostel', 'student room', 'pg accommodation', 'कोचिंग', 'ट्यूशन', 'छात्र'],
    value: 'Bihar has ~26 lakh students enrolled in higher education',
    source: 'AISHE',
    asOf: '2026-10',
  },
  {
    match: ['farmer', 'kisan', 'crop', 'agri', 'kheti', 'किसान', 'खेती', 'फसल'],
    value: 'Bihar has ~1.6 crore operational landholdings, ~91% marginal (<1 ha)',
    source: 'Agriculture Census',
    asOf: '2026-10',
  },
]

/**
 * Returns a dated, sourced market figure for the sector named in the founder's
 * own words, or null. Never guesses: no keyword match means no figure.
 */
export function marketFindingFor(text: string): string | null {
  if (!text) return null
  const haystack = text.toLowerCase()
  for (const fact of MARKET_FACTS) {
    if (fact.match.some((kw) => haystack.includes(kw))) {
      return markVerified(fact.value, fact.asOf, fact.source)
    }
  }
  return null
}
