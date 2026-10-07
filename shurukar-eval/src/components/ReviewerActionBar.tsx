'use client'

import { useState, useTransition, useEffect } from 'react'
import { updateReviewerDecision } from '@/actions/reviewerAction'

export default function ReviewerActionBar({ 
  candidateId, 
  currentDecision 
}: { 
  candidateId: string
  currentDecision: string | null 
}) {
  const [decision, setDecision] = useState<string | null>(currentDecision)
  const [isPending, startTransition] = useTransition()
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const handleAction = (newDecision: 'advance' | 'hold' | 'needs_info') => {
    setDecision(newDecision)
    setToastMessage(`Decision set to ${newDecision.toUpperCase()}`)
    setTimeout(() => setToastMessage(null), 3000)

    startTransition(async () => {
      const res = await updateReviewerDecision(candidateId, newDecision)
      if (!res.success) {
        setToastMessage(`Error: ${res.error}`)
      }
    })
  }

  // Keyboard shortcuts for reviewer decisions: A, H, I
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return
      }

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        handleAction('advance')
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault()
        handleAction('hold')
      } else if (e.key === 'i' || e.key === 'I' || e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        handleAction('needs_info')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [candidateId])

  return (
    <div className="sticky bottom-4 z-40 bg-[#0F172A]/95 backdrop-blur border border-[#1E293B] p-4 rounded-xl shadow-2xl flex flex-wrap items-center justify-between gap-4 font-mono">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] text-[#64748B] uppercase tracking-wider font-semibold">Reviewer Decision</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${
              decision === 'advance' ? 'bg-emerald-400 animate-pulse' :
              decision === 'hold' ? 'bg-amber-400' :
              decision === 'needs_info' ? 'bg-rose-400' :
              'bg-[#64748B]'
            }`} />
            <span className="text-sm font-bold text-white capitalize">
              {decision ? decision.replace('_', ' ') : 'Unreviewed'}
            </span>
            {isPending && <span className="text-[10px] text-sky-400 animate-spin">⟳</span>}
          </div>
        </div>

        {toastMessage && (
          <span className="text-xs px-2.5 py-1 bg-[#1E293B] text-sky-300 rounded border border-sky-500/20 animate-fade-in">
            {toastMessage}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Advance Button */}
        <button
          type="button"
          onClick={() => handleAction('advance')}
          disabled={isPending}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-sm ${
            decision === 'advance'
              ? 'bg-emerald-500 text-[#090D16] ring-2 ring-emerald-400'
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 active:scale-95'
          }`}
        >
          <span>Advance</span>
          <kbd className="bg-emerald-950/60 text-emerald-300 border-emerald-800">A</kbd>
        </button>

        {/* Hold Button */}
        <button
          type="button"
          onClick={() => handleAction('hold')}
          disabled={isPending}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-sm ${
            decision === 'hold'
              ? 'bg-amber-500 text-[#090D16] ring-2 ring-amber-400'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 active:scale-95'
          }`}
        >
          <span>Hold</span>
          <kbd className="bg-amber-950/60 text-amber-300 border-amber-800">H</kbd>
        </button>

        {/* Needs Info Button */}
        <button
          type="button"
          onClick={() => handleAction('needs_info')}
          disabled={isPending}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-sm ${
            decision === 'needs_info'
              ? 'bg-rose-500 text-[#090D16] ring-2 ring-rose-400'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 active:scale-95'
          }`}
        >
          <span>Needs Info</span>
          <kbd className="bg-rose-950/60 text-rose-300 border-rose-800">I</kbd>
        </button>
      </div>
    </div>
  )
}
