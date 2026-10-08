'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

interface Counts {
  unscored: number
  stale: number
  total: number
  layaConfigured: boolean
  questionSetVersion?: string
}

interface RunResult {
  requested: number
  scored: number
  stillUnscored: number
  bands?: Record<string, number>
  elapsedMs?: number
  error?: string
}

/**
 * Scoring on demand, from the page a reviewer is already on.
 *
 * Deliberately shows what it is about to do before doing it, and what actually
 * happened afterwards — including candidates that stayed `unscored`, which is a
 * real outcome rather than a failure. Scoring is slow (Laya takes roughly half
 * a second to a second per question per candidate), so the button names the
 * count and stays disabled for the whole run.
 */
export default function ScoreButton({ initial }: { initial: Counts }) {
  const router = useRouter()
  // Seeded from the server so the first paint already names the real counts.
  // Fetching them only in an effect made the button render "nothing unscored"
  // for a beat, which reads as a finished queue rather than a loading one.
  const [counts, setCounts] = useState<Counts | null>(initial)
  const [running, setRunning] = useState<null | 'unscored' | 'all'>(null)
  const [result, setResult] = useState<RunResult | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/score', { cache: 'no-store' })
      if (res.ok) setCounts((await res.json()) as Counts)
    } catch {
      // The counts are a convenience; the buttons still work without them.
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const run = async (scope: 'unscored' | 'all') => {
    setRunning(scope)
    setResult(null)
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
      setRunning(null)
    }
  }

  const pending = counts?.unscored ?? 0
  const busy = running !== null
  const btn =
    'rounded px-2.5 py-1.5 text-[11px] font-mono border transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="mb-4 bg-[#0F172A] border border-[#1E293B] rounded-lg p-2.5 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy || pending === 0}
        onClick={() => void run('unscored')}
        className={`${btn} border-sky-500/40 text-sky-200 hover:border-sky-400 hover:bg-sky-500/10`}
      >
        {running === 'unscored'
          ? `scoring ${pending}…`
          : pending === 0
            ? 'nothing unscored'
            : `score ${pending} unscored`}
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={() => void run('all')}
        className={`${btn} border-[#334155] text-[#CBD5E1] hover:border-[#475569] hover:bg-[#1E293B]`}
      >
        {running === 'all' ? `re-scoring ${counts?.total ?? ''}…` : `re-score all ${counts?.total ?? ''}`}
      </button>

      {busy && (
        <span className="text-[11px] font-mono text-[#64748B]">
          about half a second per question per candidate — leave this tab open
        </span>
      )}

      {!busy && counts && counts.stale > 0 && (
        <span className="text-[11px] font-mono text-amber-400/90">
          {counts.stale} scored against an older question set — re-score before ranking
        </span>
      )}

      {!busy && counts && !counts.layaConfigured && (
        <span className="text-[11px] font-mono text-amber-400/90">
          LAYA_API_KEY is not set — everything will land unscored, which is the correct state
        </span>
      )}

      {!busy && result && (
        <span className="text-[11px] font-mono text-[#94A3B8]">
          {result.error ? (
            <span className="text-rose-400">failed: {result.error}</span>
          ) : (
            <>
              scored {result.scored} of {result.requested}
              {result.stillUnscored > 0 && (
                <span className="text-[#64748B]">
                  {' '}
                  · {result.stillUnscored} still unscored (missing evidence, not a low score)
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
