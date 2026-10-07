'use client'

import { useState } from 'react'
import { FitChip } from './BandChip'

export interface FitQuestion {
  key: string
  label: string | null
  phrase: string | null
  confidence: number | null
  probabilities: Record<string, number>
  missing: boolean
  value: number | null
  weight: number
}

interface FitCardProps {
  title: string
  score: number | null
  floor: number
  questions: FitQuestion[]
  missing: string[]
  cappedHere?: boolean
}

/** The model's distribution over a question's labels, drawn as proportions. */
function Distribution({ probabilities, chosen }: { probabilities: Record<string, number>; chosen: string | null }) {
  const entries = Object.entries(probabilities).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) {
    return (
      <p className="text-[10px] text-[#64748B] italic mt-1.5">
        No distribution returned for this answer.
      </p>
    )
  }
  return (
    <div className="mt-2 flex flex-col gap-1">
      {entries.map(([label, p]) => {
        const pct = Math.max(0, Math.min(1, p)) * 100
        const isChosen = chosen !== null && label.toLowerCase() === chosen.toLowerCase()
        return (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`w-36 shrink-0 text-[10px] font-mono truncate ${
                isChosen ? 'text-sky-300 font-semibold' : 'text-[#64748B]'
              }`}
            >
              {label}
            </span>
            <div className="flex-1 h-1.5 bg-[#1E293B] rounded overflow-hidden">
              <div
                className={`h-full rounded ${isChosen ? 'bg-sky-400' : 'bg-slate-600'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-[10px] font-mono text-[#64748B]">
              {pct.toFixed(0)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function FitCard({ title, score, floor, questions, missing, cappedHere }: FitCardProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div
      className={`bg-[#0F172A] border rounded-lg overflow-hidden ${
        cappedHere ? 'border-amber-500/40' : 'border-[#1E293B]'
      }`}
    >
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-[#111827] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[#64748B] font-mono text-xs">{isOpen ? '▾' : '▸'}</span>
          <span className="font-semibold text-sm truncate">{title}</span>
          <span className="text-[10px] font-mono text-[#64748B]">
            {questions.length} question{questions.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {score !== null && score < floor && (
            <span className="text-[10px] font-mono text-amber-300">below floor {floor}</span>
          )}
          <FitChip score={score} label={title} />
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-[#1E293B] p-4 bg-[#090D16]/60 flex flex-col gap-3">
          {questions.length === 0 ? (
            <p className="text-xs text-[#64748B] italic">
              No answers recorded for this fit — the model was not reached.
            </p>
          ) : (
            questions.map((q) => (
              <div
                key={q.key}
                className={`p-3 rounded-lg border text-xs ${
                  q.missing
                    ? 'bg-[#111827]/60 border-dashed border-[#334155]'
                    : 'bg-[#111827] border-[#1E293B]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sky-300 font-mono font-semibold">{q.key}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {q.weight < 1 && (
                      <span
                        title={`Weighted ${q.weight} inside this fit`}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1E293B] text-[#64748B]"
                      >
                        ×{q.weight}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        q.confidence !== null && q.confidence < 0.5
                          ? 'bg-amber-500/15 text-amber-300'
                          : 'bg-[#1E293B] text-[#94A3B8]'
                      }`}
                    >
                      conf {q.confidence === null ? '—' : q.confidence.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[#64748B]">label</span>
                  <span
                    className={`font-mono font-semibold px-2 py-0.5 rounded border ${
                      q.missing
                        ? 'bg-[#1E293B]/60 border-[#334155] text-[#94A3B8]'
                        : 'bg-[#1E293B]/80 border-[#334155]/40 text-white'
                    }`}
                  >
                    {q.label ?? 'no answer'}
                  </span>
                  {q.phrase && <span className="text-[#94A3B8]">— {q.phrase}</span>}
                  {q.missing && (
                    <span className="text-[10px] text-amber-300/80">
                      excluded from the score, not counted against the founder
                    </span>
                  )}
                </div>

                <Distribution probabilities={q.probabilities} chosen={q.label} />
              </div>
            ))
          )}

          {missing.length > 0 && (
            <p className="text-[11px] text-[#64748B] border-t border-[#1E293B] pt-3">
              Not established here: <span className="font-mono">{missing.join(', ')}</span>. Missing
              evidence lowers confidence and routes to a reviewer — it never lowers the band.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
