const BAND_STYLES: Record<string, string> = {
  strong: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  promising: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  early: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  unscored: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
}

export function BandChip({ band, title }: { band: string; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-mono font-semibold uppercase tracking-wide ${
        BAND_STYLES[band] ?? BAND_STYLES.unscored
      }`}
    >
      {band}
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
        className="inline-flex w-12 justify-center px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800/50 text-slate-500 text-[11px] font-mono"
      >
        —
      </span>
    )
  }
  const tone =
    score >= 72
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
      : score >= 50
        ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
        : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
  return (
    <span
      title={`${label}: ${score}`}
      className={`inline-flex w-12 justify-center px-1.5 py-0.5 rounded border text-[11px] font-mono font-semibold ${tone}`}
    >
      {score}
    </span>
  )
}

const FLAG_TONES: Array<[RegExp, string]> = [
  [/spam/, 'bg-rose-500/15 text-rose-300 border-rose-500/40'],
  [/contradiction/, 'bg-orange-500/15 text-orange-300 border-orange-500/40'],
  [/low_confidence|missing_evidence|thin_dossier/, 'bg-amber-500/15 text-amber-300 border-amber-500/40'],
  [/laya_unavailable/, 'bg-slate-500/15 text-slate-300 border-slate-500/40'],
]

export function FlagChip({ flag }: { flag: string }) {
  const tone =
    FLAG_TONES.find(([re]) => re.test(flag))?.[1] ??
    'bg-slate-500/15 text-slate-300 border-slate-500/40'
  const short = flag.split(':')[0]
  return (
    <span
      title={flag}
      className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-mono ${tone}`}
    >
      {short}
    </span>
  )
}
