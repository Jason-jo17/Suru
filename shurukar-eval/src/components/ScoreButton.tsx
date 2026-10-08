'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface ScoreCounts {
  /** Never assessed, or assessed against a superseded question set. */
  pending: number
  /** Only the version mismatch. A subset of pending. */
  stale: number
  /** Ran under the current question set and still could not be banded. */
  unscoreable: number
  total: number
  layaConfigured: boolean
  questionSetVersion?: string
}

interface RunResult {
  requested: number
  scored: number
  stillUnscored: number
  elapsedMs?: number
  error?: string
}

/** Roughly what one candidate costs: ~12 questions at about a second each. */
const SECONDS_PER_CANDIDATE = 14

/**
 * Scoring from the page a reviewer is already on.
 *
 * Two things this is careful about, both learned the hard way:
 *
 * It never offers to re-run candidates that already ran and came back
 * `unscored`. That outcome means spam, a dossier too thin to band, or an answer
 * the model could not separate from chance — another run cannot change any of
 * them. The first version of this button swept them in, spent a hundred and one
 * seconds, and reported no change, which read as a broken button.
 *
 * And it shows elapsed time against an estimate, because the run genuinely
 * takes minutes. A disabled button with no clock is indistinguishable from one
 * that did nothing.
 */
export default function ScoreButton({ initial }: { initial: ScoreCounts }) {
  const router = useRouter()
  const [counts, setCounts] = useState<ScoreCounts>(initial)
  const [running, setRunning] = useState<null | 'pending' | 'all'>(null)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<RunResult | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/score', { cache: 'no-store' })
      if (res.ok) setCounts((await res.json()) as ScoreCounts)
    } catch {
      // The counts are a convenience; the buttons work without a refresh.
    }
  }, [])

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [])

  const run = async (scope: 'pending' | 'all') => {
    setRunning(scope)
    setResult(null)
    setElapsed(0)
    timer.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      })
      setResult((await res.json()) as RunResult)
      await refresh()
      router.refresh()
    } catch (err) {
      setResult({ requested: 0, scored: 0, stillUnscored: 0, error: (err as Error).message })
    } finally {
      if (timer.current) clearInterval(timer.current)
      setRunning(null)
    }
  }

  const busy = running !== null
  const expected = (running === 'all' ? counts.total : counts.pending) * SECONDS_PER_CANDIDATE
  const btn =
    'rounded px-2.5 py-1.5 text-[11px] font-mono border transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="mb-4 bg-[#0F172A] border border-[#1E293B] rounded-lg p-2.5 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy || counts.pending === 0}
        onClick={() => void run('pending')}
        className={`${btn} border-sky-500/40 text-sky-200 hover:border-sky-400 hover:bg-sky-500/10`}
        title={
          counts.pending === 0
            ? 'Every candidate has been scored against the current question set.'
            : `${counts.pending} never scored, or scored against an older question set.`
        }
      >
        {running === 'pending'
          ? `scoring ${counts.pending}…`
          : counts.pending === 0
            ? 'all scored · nothing waiting'
            : `score ${counts.pending} waiting`}
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={() => void run('all')}
        className={`${btn} border-[#334155] text-[#CBD5E1] hover:border-[#475569] hover:bg-[#1E293B]`}
        title="Re-runs every candidate, including the ones a rerun cannot change."
      >
        {running === 'all' ? `re-scoring ${counts.total}…` : `re-score all ${counts.total}`}
      </button>

      {busy && (
        <span className="text-[11px] font-mono text-sky-300/90">
          {elapsed}s elapsed
          {expected > 0 && <span className="text-[#64748B]"> · roughly {expected}s expected</span>}
          <span className="text-[#64748B]"> · leave this tab open</span>
        </span>
      )}

      {!busy && counts.unscoreable > 0 && (
        <Link
          href="/candidates?unscored=true"
          className="text-[11px] font-mono text-amber-400/90 hover:text-amber-300 underline decoration-dotted"
          title="Spam, a dossier too thin to band, or an answer too close to chance. Another run cannot change these."
        >
          {counts.unscoreable} need a human, not another run
        </Link>
      )}

      {!busy && counts.stale > 0 && (
        <span className="text-[11px] font-mono text-amber-400/90">
          {counts.stale} on an older question set — not comparable until re-scored
        </span>
      )}

      {!busy && !counts.layaConfigured && (
        <span className="text-[11px] font-mono text-amber-400/90">
          LAYA_API_KEY is not set — everything lands unscored, which is the correct state
        </span>
      )}

      {!busy && result && (
        <span className="text-[11px] font-mono text-[#94A3B8]">
          {result.error ? (
            <span className="text-rose-400">failed: {result.error}</span>
          ) : result.requested === 0 ? (
            'nothing was waiting'
          ) : (
            <>
              scored {result.scored}
              {result.stillUnscored > 0 && (
                <span className="text-[#64748B]">
                  {' '}
                  · {result.stillUnscored} could not be banded
                </span>
              )}
              {typeof result.elapsedMs === 'number' && (
                <span className="text-[#64748B]"> · {Math.round(result.elapsedMs / 1000)}s</span>
              )}
            </>
          )}
        </span>
      )}
    </div>
  )
}
