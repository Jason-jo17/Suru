'use client'

import { useState } from 'react'

interface FitCardProps {
  title: string
  score: number | null
  confidence?: number | null
  questions: Array<{
    key: string
    choice: string
    confidence: number | string
    probabilities?: Record<string, number>
  }>
}

export default function FitCard({ title, score, confidence, questions }: FitCardProps) {
  const [isOpen, setIsOpen] = useState(false)

  const getScoreColor = (val: number | null) => {
    if (val === null) return 'text-[#64748B]'
    if (val >= 75) return 'text-emerald-400'
    if (val >= 50) return 'text-sky-400'
    if (val >= 30) return 'text-amber-400'
    return 'text-rose-400'
  }

  const getProgressColor = (val: number | null) => {
    if (val === null) return 'bg-[#334155]'
    if (val >= 75) return 'bg-emerald-500'
    if (val >= 50) return 'bg-sky-500'
    if (val >= 30) return 'bg-amber-500'
    return 'bg-rose-500'
  }

  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl overflow-hidden shadow-sm transition-all hover:border-[#334155] font-mono">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-4 flex items-center justify-between cursor-pointer select-none bg-gradient-to-r from-transparent via-transparent to-[#111827]/40 hover:bg-[#111827]/60 transition-colors"
      >
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-[#64748B] font-bold">{title}</span>
            <span className="text-[10px] text-[#475569]">({questions.length} questions)</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl font-black ${getScoreColor(score)}`}>
              {score !== null ? score : '—'}
            </span>
            {score !== null && <span className="text-xs text-[#64748B]">/ 100</span>}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {score !== null && (
            <div className="w-24 hidden sm:block">
              <div className="w-full bg-[#1E293B] h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${getProgressColor(score)} transition-all duration-500`}
                  style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="text-right">
            <span className="text-[10px] text-[#64748B] block">CONFIDENCE</span>
            <span className="text-xs font-semibold text-white">
              {confidence !== undefined && confidence !== null ? `${Math.round(Number(confidence) * 100)}%` : '—'}
            </span>
          </div>

          <div className="text-[#64748B] text-xs transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ▼
          </div>
        </div>
      </div>

      {/* Progress Track for Mobile */}
      {score !== null && (
        <div className="w-full bg-[#1E293B] h-1 overflow-hidden sm:hidden">
          <div 
            className={`h-full ${getProgressColor(score)}`}
            style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }}
          />
        </div>
      )}

      {/* Expandable Question Breakdown */}
      {isOpen && (
        <div className="border-t border-[#1E293B] p-4 bg-[#090D16]/60 flex flex-col gap-3">
          {questions.length === 0 ? (
            <p className="text-xs text-[#64748B] italic">No underlying questions recorded for this fit.</p>
          ) : (
            questions.map(q => (
              <div key={q.key} className="p-3 bg-[#111827] border border-[#1E293B] rounded-lg text-xs">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-sky-300 font-bold">{q.key}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1E293B] text-[#94A3B8]">
                    Conf: {q.confidence}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#64748B]">Model Choice:</span>
                  <span className="font-semibold text-white px-2 py-0.5 rounded bg-[#1E293B]/80 border border-[#334155]/40">
                    {q.choice}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
