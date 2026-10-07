/**
 * Column header -> stable fieldId.
 *
 * Intake exports do NOT have stable column headers: the Hindi-first form ships
 * Hindi sentences as headers, and anyone editing a question title in the form
 * breaks the mapping. A silently dropped column looks exactly like a founder
 * who did not answer, so every header must be declared here and
 * `assertAllMapped` throws on anything it has not seen before.
 */

/** The stable field ids. Everything downstream keys off these, never a header. */
export const FIELD_IDS = [
  'name',
  'district',
  'block',
  'persona',
  'commitment_type',
  'team_size',
  'registration_status',
  'problem_solution',
  'inspiration',
  'purpose',
  'founder_proximity',
  'prior_venture_closed',
  'who_will_use',
  'aspiration',
  'growth_ambition',
  'declared_stage',
  'constraint',
  'alternatives_today',
  'customers_spoken_to',
  'validation_done',
  'willingness_to_pay',
  'route_to_market',
  'access_route',
  'time_in_line',
  'users_count',
  'paying_customers',
  'monthly_income',
  'retention_signal',
  'time_commitment',
] as const

export type FieldId = (typeof FIELD_IDS)[number]

/**
 * Metadata columns that carry no founder answer. They are mapped so that
 * assertAllMapped does not throw on them, but they never become a RawResponse.
 */
export const META_COLUMNS = new Set([
  'external_id',
  'language',
  'consent_at',
  'timestamp',
  '_expected',
])

/**
 * Headers are normalised before lookup so that trailing required-markers,
 * stray whitespace, casing and terminal punctuation do not break a mapping.
 */
export function normalizeHeader(header: string): string {
  return header
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[*?？।:]+$/u, '')
    .trim()
    .toLowerCase()
}

const RAW_FIELD_MAP: Record<string, string> = {
  // --- stable ids, so an already-normalised export round-trips ---
  ...Object.fromEntries(FIELD_IDS.map((id) => [id, id])),

  // --- metadata ---
  external_id: 'external_id',
  externalid: 'external_id',
  'submission id': 'external_id',
  language: 'language',
  'preferred language': 'language',
  consent_at: 'consent_at',
  consent: 'consent_at',
  timestamp: 'timestamp',
  'submitted at': 'timestamp',
  _expected: '_expected',

  // --- English question titles ---
  'what is your name': 'name',
  'full name': 'name',
  'which district are you from': 'district',
  'district': 'district',
  'which block are you from': 'block',
  'which of these describes you best': 'persona',
  'are you working on this full time or part time': 'commitment_type',
  'how many people are in your team': 'team_size',
  'is your business registered': 'registration_status',
  'what problem are you solving and how': 'problem_solution',
  'where did this idea come from': 'inspiration',
  'why do you want to do this': 'purpose',
  'what is your experience in this area': 'founder_proximity',
  'have you closed a business before': 'prior_venture_closed',
  'who will use this': 'who_will_use',
  'what do you want to achieve in five years': 'aspiration',
  'how big do you want to grow this': 'growth_ambition',
  'what stage are you at': 'declared_stage',
  'what do you need most right now': 'constraint',
  'what do people do about this today': 'alternatives_today',
  'how many customers have you spoken to': 'customers_spoken_to',
  'how have you tested your idea': 'validation_done',
  'are people willing to pay for this': 'willingness_to_pay',
  'how will you reach your first customer': 'route_to_market',
  'how will you reach the market': 'access_route',
  'how long have you been doing this': 'time_in_line',
  'how many people use it now': 'users_count',
  'how many customers pay you': 'paying_customers',
  'what is your monthly income from this': 'monthly_income',
  'do customers come back': 'retention_signal',
  'how many hours a week can you give this': 'time_commitment',

  // --- Hindi form titles (the Hindi-first intake) ---
  'आपका नाम क्या है': 'name',
  'आपका पूरा नाम': 'name',
  'आपका जिला कौन सा है': 'district',
  'आपका ब्लॉक कौन सा है': 'block',
  'आप इनमें से क्या हैं': 'persona',
  'आप इस पर पूरा समय दे रहे हैं या अंशकालिक': 'commitment_type',
  'आपकी टीम में कितने लोग हैं': 'team_size',
  'क्या आपका व्यवसाय पंजीकृत है': 'registration_status',
  'आप कौन सी समस्या हल कर रहे हैं और कैसे': 'problem_solution',
  'आपको यह विचार कहाँ से आया': 'inspiration',
  'आप यह क्यों करना चाहते हैं': 'purpose',
  'इस क्षेत्र में आपका क्या अनुभव है': 'founder_proximity',
  'क्या आपने पहले कोई व्यवसाय बंद किया है': 'prior_venture_closed',
  'इसका उपयोग कौन करेगा': 'who_will_use',
  'आप अगले पाँच साल में क्या हासिल करना चाहते हैं': 'aspiration',
  'आप अपने काम को कितना बड़ा करना चाहते हैं': 'growth_ambition',
  'आप अभी किस चरण में हैं': 'declared_stage',
  'आपको किस चीज़ की सबसे ज़्यादा ज़रूरत है': 'constraint',
  'लोग आज यह काम कैसे करते हैं': 'alternatives_today',
  'आपने कितने ग्राहकों से बात की है': 'customers_spoken_to',
  'आपने अपने विचार को कैसे परखा है': 'validation_done',
  'क्या लोग इसके लिए पैसे देने को तैयार हैं': 'willingness_to_pay',
  'आप अपने पहले ग्राहक तक कैसे पहुँचेंगे': 'route_to_market',
  'आप बाज़ार तक कैसे पहुँचेंगे': 'access_route',
  'आप कितने समय से यह काम कर रहे हैं': 'time_in_line',
  'अभी कितने लोग इसका उपयोग कर रहे हैं': 'users_count',
  'कितने ग्राहक पैसे दे रहे हैं': 'paying_customers',
  'आपकी मासिक आय कितनी है': 'monthly_income',
  'क्या ग्राहक बार-बार लौटते हैं': 'retention_signal',
  'आप हफ़्ते में कितने घंटे दे पाते हैं': 'time_commitment',
  'आप कौन सी भाषा पसंद करते हैं': 'language',
}

/** Normalised header -> fieldId. Built once at module load. */
export const fieldMap: Record<string, string> = Object.fromEntries(
  Object.entries(RAW_FIELD_MAP).map(([header, fieldId]) => [normalizeHeader(header), fieldId]),
)

export function lookupField(header: string): string | undefined {
  return fieldMap[normalizeHeader(header)]
}

/**
 * Throws listing every column this map does not know. Called on every ingest
 * before a single row is written: a header nobody declared is a data loss bug,
 * not a missing answer, and it must stop the import rather than be skipped.
 */
export function assertAllMapped(headers: string[]): void {
  const unmapped = headers.filter((h) => !lookupField(h))
  if (unmapped.length > 0) {
    throw new Error(
      `Unmapped columns found (${unmapped.length}): ${unmapped.join(' | ')}. ` +
        `Add each to src/lib/ingest/fieldMap.ts before ingesting — an unmapped ` +
        `column is silently dropped and looks identical to an unanswered question.`,
    )
  }
}

/** Rewrites a raw export row into stable fieldIds. Meta columns are dropped. */
export function normalizeRecord(record: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [header, value] of Object.entries(record)) {
    const fieldId = lookupField(header)
    if (!fieldId || META_COLUMNS.has(fieldId)) continue
    out[fieldId] = value
  }
  return out
}

/** Pulls the metadata columns (language, consent, external id) off a raw row. */
export function extractMeta(record: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [header, value] of Object.entries(record)) {
    const fieldId = lookupField(header)
    if (fieldId && META_COLUMNS.has(fieldId)) out[fieldId] = value
  }
  return out
}
