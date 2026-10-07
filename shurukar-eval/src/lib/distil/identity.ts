/**
 * Identity stripping. Nothing that reaches the model may carry who the founder
 * is: name, gender, age, caste or community, or the *name* of an institution.
 *
 * Everything here is removal or substitution. It never adds a judgement — a
 * stripper that rewrote "ran a pharmacy" into "strong domain experience" would
 * be doing Laya's job, and the score would then measure this file's opinion.
 */

export const IDENTITY_STRIPPER_VERSION = 'identity-1.0'

/**
 * Word boundary that also holds for Devanagari, which \b does not.
 *
 * Combining marks (\p{M}) count as part of a word: Hindi vowel signs and the
 * virama are category Mn, so leaving them out would make "यादव" match inside
 * "यादवों" and redact half a word that was never a caste marker.
 */
function boundary(body: string, flags = 'giu'): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}\\p{M}])(?:${body})(?![\\p{L}\\p{N}\\p{M}])`, flags)
}

const HONORIFICS = [
  'mr', 'mrs', 'ms', 'miss', 'master', 'shri', 'sri', 'smt', 'kumari', 'km',
  'dr', 'prof', 'sh', 'shrimati',
  'श्री', 'श्रीमती', 'कुमारी', 'सुश्री', 'डॉ',
]

/** Institution *brands*. The role and duration stay; the brand goes. */
const INSTITUTION_BRANDS = [
  'iit', 'iim', 'iiit', 'nit', 'bit', 'bits', 'aiims', 'nift', 'nid', 'xlri',
  'isb', 'icai', 'nalsa', 'nlu', 'vit', 'srm', 'manipal', 'amity', 'lpu',
  'du', 'jnu', 'bhu', 'amu', 'jamia', 'aligarh', 'presidency', 'st xaviers',
  "st\\.? xavier'?s", 'loyola', 'christ university', 'symbiosis',
  'harvard', 'stanford', 'mit', 'oxford', 'cambridge', 'yale', 'princeton',
  'wharton', 'insead', 'lse', 'berkeley', 'columbia university',
  'infosys', 'tcs', 'wipro', 'accenture', 'deloitte', 'cognizant', 'hcl',
  'patna university', 'nalanda', 'magadh university', 'chanakya',
  'आईआईटी', 'आईआईएम', 'एनआईटी', 'एम्स', 'पटना यूनिवर्सिटी',
]

/** Explicit caste, community and religion markers. */
const COMMUNITY_MARKERS = [
  'sc', 'st', 'obc', 'ews', 'general category', 'reserved category',
  'scheduled caste', 'scheduled tribe', 'mahadalit', 'dalit',
  'brahmin', 'bhumihar', 'rajput', 'kayastha', 'yadav', 'kurmi', 'koeri',
  'musahar', 'paswan', 'ravidas', 'chamar', 'teli', 'baniya', 'vaishya',
  'kshatriya', 'thakur', 'pandit',
  'hindu', 'muslim', 'musalman', 'sikh', 'christian', 'isai', 'jain',
  'buddhist', 'minority community',
  'ब्राह्मण', 'भूमिहार', 'राजपूत', 'यादव', 'कुर्मी', 'दलित', 'महादलित',
  'हिंदू', 'मुसलमान', 'मुस्लिम', 'सिख', 'ईसाई',
]

const GENDER_SUBSTITUTIONS: Array<[RegExp, string]> = [
  [boundary('he|she'), 'they'],
  [boundary('him'), 'them'],
  [boundary('his|hers|her'), 'their'],
  [boundary('himself|herself'), 'themselves'],
  [boundary('man|woman|male|female|boy|girl|gentleman|lady'), 'person'],
  [boundary('men|women|males|females|boys|girls'), 'people'],
  [boundary('son|daughter'), 'child'],
  [boundary('husband|wife'), 'spouse'],
  [boundary('father|mother'), 'parent'],
  [boundary('brother|sister'), 'sibling'],
  [boundary('ladka|ladki|aurat|aadmi|mard'), 'person'],
  [boundary('लड़का|लड़की|औरत|आदमी|पुरुष|महिला'), 'व्यक्ति'],
  [boundary('बेटा|बेटी'), 'संतान'],
  [boundary('पति|पत्नी'), 'जीवनसाथी'],
]

/** "I am 34", "34 years old", "34 saal ka", "उम्र 34" */
const AGE_PATTERNS: RegExp[] = [
  /\b(?:i\s+am|i'm|aged?|age(?:\s+is)?)\s+\d{1,2}\s*(?:years?\s*(?:old)?)?\b/giu,
  /\b\d{1,2}\s*(?:years?|yrs?)\s*old\b/giu,
  /\b\d{1,2}\s*saal\s*(?:ka|ki|ke)\b/giu,
  /(?:उम्र|आयु)\s*[:\-]?\s*\d{1,2}\s*(?:साल|वर्ष)?/giu,
  /\d{1,2}\s*(?:साल|वर्ष)\s*(?:का|की|के)\b/giu,
]

/** Photographs and other media of the person. Laya has no vision anyway. */
const MEDIA_PATTERNS: RegExp[] = [
  /\bhttps?:\/\/\S+\.(?:jpe?g|png|gif|webp|heic|bmp|tiff?|mp4|mov|pdf)\b/giu,
  /\b(?:drive|photos)\.google\.com\/\S+/giu,
  /\b\S+\.(?:jpe?g|png|gif|webp|heic)\b/giu,
]

const REDACTION = '[redacted]'

export interface StripOptions {
  /** The founder's own name, so its tokens can be removed wherever they appear. */
  name?: string
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Name tokens worth removing: skip initials and very short fragments. */
function nameTokens(name: string): string[] {
  return name
    .replace(/\(.*?\)/g, ' ')
    .split(/[\s.,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
}

/**
 * Strips identity from one free-text answer. Deterministic: the same input
 * always yields the same output, which is what makes a re-score reproducible.
 */
export function stripIdentity(value: string, opts: StripOptions = {}): string {
  if (!value) return value
  let out = value

  // 1. the founder's own name, and honorifics attached to any name
  if (opts.name) {
    for (const token of nameTokens(opts.name)) {
      out = out.replace(boundary(escapeRe(token)), REDACTION)
    }
  }
  out = out.replace(
    new RegExp(
      `(?<![\\p{L}\\p{N}\\p{M}])(?:${HONORIFICS.map(escapeRe).join('|')})\\.?(?![\\p{L}\\p{N}\\p{M}])`,
      'giu',
    ),
    '',
  )

  // 2. photographs and attachments
  for (const re of MEDIA_PATTERNS) out = out.replace(re, REDACTION)

  // 3. age
  for (const re of AGE_PATTERNS) out = out.replace(re, '')

  // 4. caste, community, religion
  out = out.replace(boundary(COMMUNITY_MARKERS.map(escapeRe).join('|')), REDACTION)

  // 5. institution brands -> a neutral placeholder, so "studied at IIT" keeps
  //    the role ("studied") and loses the brand.
  out = out.replace(boundary(INSTITUTION_BRANDS.join('|')), '[institution]')

  // 6. gender
  for (const [re, replacement] of GENDER_SUBSTITUTIONS) out = out.replace(re, replacement)

  // 7. tidy up what the removals left behind
  out = out
    .replace(/\[redacted\](?:[\s,]*\[redacted\])+/g, REDACTION)
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?])(?:\s*\1)+/g, '$1')
    .replace(/,\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;:.-]+/, '')
    .trim()

  return out
}

/** Durations, so background can keep "six years" without keeping the brand. */
const DURATION_RE =
  /(\d+\+?\s*(?:years?|yrs?|months?|saal|mahine|महीने|साल|वर्ष))|((?:six|five|four|three|two|ten|seven|eight|nine)\s+years?)/iu

export function extractDuration(value: string): string | null {
  const m = value?.match(DURATION_RE)
  return m ? m[0].trim() : null
}

/**
 * Background as a role and a duration. Composed only from what was said:
 * the stripped proximity text, with a duration from `time_in_line` appended
 * when the proximity text does not already carry one.
 */
export function composeBackground(
  proximityText: string | undefined,
  timeInLine: string | undefined,
  opts: StripOptions = {},
): string | undefined {
  const role = proximityText ? stripIdentity(proximityText, opts) : ''
  if (!role) {
    const soloDuration = timeInLine ? stripIdentity(timeInLine, opts) : ''
    return soloDuration || undefined
  }
  if (extractDuration(role)) return role
  const duration = timeInLine ? extractDuration(timeInLine) : null
  return duration ? `${role} (${duration})` : role
}
