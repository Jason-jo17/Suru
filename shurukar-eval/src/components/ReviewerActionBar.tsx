'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  saveReviewerNote,
  updateReviewerDecision,
  type ReviewerDecision,
} from '@/actions/reviewerAction'

interface Props {
  candidateId: string
  currentDecision: string | null
  currentNote: string | null
  reviewedBy: string | null
  reviewedAt: string | null
}

const OPTIONS: Array<{ value: ReviewerDecision; label: string; key: string; tone: string }> = [
  {
    value: 'advance',
    label: 'Advance',
    key: 'a',
    tone: 'border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10 data-[active=true]:bg-emerald-500/20',
  },
  {
    value: 'hold',
    label: 'Hold',
    key: 'h',
    tone: 'border-amber-500/50 text-amber-300 hover:bg-amber-500/10 data-[active=true]:bg-amber-500/20',
  },
  {
    value: 'needs_info',
    label: 'Needs info',
    key: 'i',
    tone: 'border-sky-500/50 text-sky-300 hover:bg-sky-500/10 data-[active=true]:bg-sky-500/20',
  },
]

export default function ReviewerActionBar({
  candidateId,
  currentDecision,
  currentNote,
  reviewedBy,
  reviewedAt,
}: Props) {
  const [decision, setDecision] = useState(currentDecision)
  const [note, setNote] = useState(currentNote ?? '')
  const [who, setWho] = useState(reviewedBy ?? '')
  const [status, setStatus] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const act = useCallback(
    async (value: ReviewerDecision) => {
      setPending(true)
      setStatus(null)
      const result = await updateReviewerDecision(candidateId, value, note, who)
      setPending(false)
      if (result.success) {
        setDecision(value)
        setStatus(`Recorded "${value.replace('_', ' ')}".`)
      } else {
        setStatus(result.error ?? 'Could not record the decision.')
      }
    },
    [candidateId, note, who],
  )

  const onlyNote = useCallback(async () => {
    setPending(true)
    setStatus(null)
    const result = await saveReviewerNote(candidateId, note, who)
    setPending(false)
    setStatus(result.success ? 'Note saved.' : (result.error ?? 'Could not save the note.'))
  }, [candidateId, note, who])

  // A reviewer doing 200 of these will not use a mouse.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()
      if (key === 'n') {
        e.preventDefault()
        noteRef.current?.focus()
        return
      }
      const option = OPTIONS.find((o) => o.key === key)
      if (option) {
        e.preventDefault()
        void act(option.value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [act])

  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Reviewer decision</h3>
          <p className="text-[11px] text-[#64748B] mt-0.5">
            This is the calibration set — thresholds are set by comparing these calls against the
            model&apos;s bands.
          </p>
        </div>
        {decision && (
          <span className="text-[11px] font-mono text-[#94A3B8]">
            current: <span className="text-white">{decision.replace('_', ' ')}</span>
            {reviewedAt ? ` · ${reviewedAt}` : ''}
            {reviewedBy ? ` · ${reviewedBy}` : ''}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={pending}
            data-active={decision === o.value}
            onClick={() => void act(o.value)}
            className={`px-3 py-1.5 rounded border text-xs font-semibold transition-colors disabled:opacity-50 ${o.tone}`}
          >
            {o.label} <kbd className="ml-1.5">{o.key.toUpperCase()}</kbd>
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] text-[#94A3B8] font-mono">
          Note <kbd>N</kbd> — why, in your words. Especially where you disagree with the band.
        </span>
        <textarea
          ref={noteRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="e.g. capped by problem_evidence, but the proximity answer makes the lived claim credible — advancing anyway."
          className="w-full bg-[#090D16] border border-[#1E293B] rounded p-2.5 text-xs font-sans text-[#F8FAFC] placeholder:text-[#475569] focus:outline-none focus:border-sky-500/60 resize-y"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={who}
          onChange={(e) => setWho(e.target.value)}
          placeholder="your name"
          className="bg-[#090D16] border border-[#1E293B] rounded px-2.5 py-1.5 text-xs font-mono text-[#F8FAFC] placeholder:text-[#475569] focus:outline-none focus:border-sky-500/60"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => void onlyNote()}
          className="px-3 py-1.5 rounded border border-[#334155] text-xs text-[#94A3B8] hover:bg-[#1E293B] disabled:opacity-50"
        >
          Save note only
        </button>
        {decision && (
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true)
              const result = await updateReviewerDecision(candidateId, null, note, who)
              setPending(false)
              if (result.success) {
                setDecision(null)
                setStatus('Decision cleared.')
              }
            }}
            className="px-3 py-1.5 rounded border border-[#334155] text-xs text-[#64748B] hover:bg-[#1E293B] disabled:opacity-50"
          >
            Clear decision
          </button>
        )}
        {status && <span className="text-[11px] font-mono text-sky-300">{status}</span>}
      </div>
    </div>
  )
}
