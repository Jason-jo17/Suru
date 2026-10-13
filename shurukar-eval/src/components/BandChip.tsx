const BAND_STYLES: Record<string, string> = {
  strong: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  promising: 'bg-sky-50 text-sky-800 border-sky-200',
  early: 'bg-amber-50 text-amber-800 border-amber-200',
  unscored: 'bg-slate-100 text-slate-700 border-slate-200',
}

const BAND_LABELS: Record<string, string> = {
  strong: 'Strong',
  promising: 'Promising',
  early: 'Early',
  unscored: 'Unscored',
}

export function BandChip({ band, title }: { band: string; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${
        BAND_STYLES[band] ?? BAND_STYLES.unscored
      }`}
    >
      {BAND_LABELS[band] ?? band}
    </span>
  )
}

/**
 * A fit score as a band chip plus its number. The number is deliberately
 * secondary: it is uncalibrated, so it informs a reviewer rather than deciding
 * anything on its own.
 */
export function FitChip({ score, label }: { score: number | null; label: string }) {
  if (score === null) {
    return (
      <span
        title={`${label}: not scored`}
        className="inline-flex w-11 justify-center py-0.5 rounded-md border border-slate-200 bg-slate-50 text-slate-400 text-xs font-mono"
      >
        —
      </span>
    )
  }
  const tone =
    score >= 72
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : score >= 50
        ? 'bg-sky-50 text-sky-800 border-sky-200'
        : 'bg-amber-50 text-amber-800 border-amber-200'
  return (
    <span
      title={`${label}: ${score}`}
      className={`inline-flex w-11 justify-center py-0.5 rounded-md border text-xs font-mono font-semibold ${tone}`}
    >
      {score}
    </span>
  )
}

const FLAG_TONES: Array<[RegExp, string]> = [
  [/spam/, 'bg-rose-50 text-rose-800 border-rose-200'],
  [/contradiction/, 'bg-accent-soft text-orange-800 border-orange-200'],
  [/low_confidence|missing_evidence|thin_dossier/, 'bg-amber-50 text-amber-800 border-amber-200'],
  [/laya_unavailable/, 'bg-slate-100 text-slate-700 border-slate-200'],
]

export function FlagChip({ flag }: { flag: string }) {
  const tone =
    FLAG_TONES.find(([re]) => re.test(flag))?.[1] ?? 'bg-slate-100 text-slate-700 border-slate-200'
  const short = flag.split(':')[0].replace(/_/g, ' ')
  return (
    <span
      title={flag}
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${tone}`}
    >
      {short}
    </span>
  )
}
