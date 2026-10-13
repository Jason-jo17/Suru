/**
 * Answer-value normalisation for the bilingual registration form.
 *
 * Every multiple-choice option in that export arrives as "<Hindi> · <English>",
 * the same label in two languages. Only the English half is kept: it is the
 * form's own wording, not a paraphrase, and sending both would spend the
 * dossier's token budget twice on one answer. "Other" options arrive as
 * "अन्य: <their words> · Other" and become "Other: <their words>".
 *
 * Free-text answers are never touched here.
 */

/** Fields whose values are fixed options on the form, never free text. */
const CHOICE_FIELDS = new Set([
  'persona',
  'commitment_type',
  'team_size',
  'registration_status',
  'growth_ambition',
  'declared_stage',
  'constraint',
  'market_need',
  'customers_spoken_to',
  'willingness_to_pay',
  'access_route',
  'time_in_line',
  'users_count',
  'paying_customers',
  'monthly_income',
  'retention_signal',
  'time_commitment',
])

export function englishOption(value: string): string {
  const v = value.trim()
  const sep = v.lastIndexOf(' · ')
  if (sep === -1) return v
  const left = v.slice(0, sep).trim()
  const right = v.slice(sep + 3).trim()
  const other = left.match(/^अन्य\s*:\s*([\s\S]*)$/u)
  if (other && /^other$/i.test(right)) return `Other: ${other[1].trim()}`
  return right || v
}

export function normalizeAnswerValues(answers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [field, value] of Object.entries(answers)) {
    out[field] = CHOICE_FIELDS.has(field) && value ? englishOption(value) : value
  }
  return out
}

/** The form's persona options -> the persona slugs the reviewer filters use. */
const PERSONA_SLUGS: Array<[RegExp, string]> = [
  [/^studying/i, 'student'],
  [/family business/i, 'family_business'],
  [/run my own|workshop|startup|company|business$/i, 'micro_entrepreneur'],
  [/^in a job/i, 'professional'],
  [/started something before|closed now/i, 'prior_founder'],
  [/homemaker|shg|social work/i, 'homemaker'],
  [/farm/i, 'farmer'],
]

export function personaSlug(value: string | undefined): string {
  const v = (value ?? '').trim()
  if (!v) return 'other'
  for (const [pattern, slug] of PERSONA_SLUGS) if (pattern.test(v)) return slug
  // Already a slug (the JSON fixture path) or something new: keep it visible.
  return /^[a-z_]+$/.test(v) ? v : 'other'
}

/** The form's stage options -> idea | built | in_market, which picks the question set. */
export function stageSlug(value: string | undefined): string {
  const v = (value ?? '').trim()
  if (/in the market|in_market/i.test(v)) return 'in_market'
  if (/built/i.test(v)) return 'built'
  if (/idea/i.test(v)) return 'idea'
  return v || 'idea'
}

/**
 * The form records no language, so it is read off the founder's own free text.
 * Anything not plainly Latin-script goes to the multilingual checkpoint: the
 * English one on Hindi or Malayalam is a silent accuracy loss, not an error.
 */
export function detectLanguage(answers: Record<string, string>): string {
  const text = [answers.problem_solution, answers.inspiration, answers.founder_proximity]
    .filter(Boolean)
    .join(' ')
  if (!text.trim()) return 'unknown'
  if (/[ऀ-ॿ]/u.test(text)) return 'hindi'
  // Letters outside Latin (and Latin-extended) mean another Indian script.
  if (/[^\p{Script=Latin}\P{L}]/u.test(text)) return 'other'
  return 'english'
}

/** "PATNA" -> "Patna", "PURBI CHAMPARAN" -> "Purbi Champaran". */
export function titleCase(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/(^|[\s(-])(\p{L})/gu, (_, pre, ch) => `${pre}${ch.toUpperCase()}`)
}
