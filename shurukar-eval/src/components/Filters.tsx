'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  BANDS,
  FLAG_TYPES,
  PERSONAS,
  REGISTRATION_STATUSES,
  REVIEWER_STATUSES,
  SORTS,
  STAGES,
} from '@/lib/query'

interface Props {
  districts: string[]
  blocks: string[]
  languages: string[]
  questionSetVersions: string[]
  total: number
}

const selectClass =
  'bg-[#090D16] border border-[#1E293B] rounded px-2 py-1.5 text-[11px] font-mono text-[#F8FAFC] focus:outline-none focus:border-sky-500/60'

/**
 * Every filter is reflected in the URL, so a filtered view is shareable and the
 * CSV export of that view returns exactly the same rows.
 */
export default function Filters({ districts, blocks, languages, questionSetVersions, total }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchRef = useRef<HTMLInputElement>(null)
  const [showScores, setShowScores] = useState(
    Boolean(
      searchParams.get('fpMin') ||
        searchParams.get('psMin') ||
        searchParams.get('smMin') ||
        searchParams.get('fpMax') ||
        searchParams.get('psMax') ||
        searchParams.get('smMax') ||
        searchParams.get('confidenceMin'),
    ),
  )

  const get = (key: string) => searchParams.get(key) ?? ''

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchRef.current) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const push = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '' || value === 'false') params.delete(key)
      else params.set(key, value)
    }
    params.delete('page') // a changed filter always returns to the first page
    router.push(`/candidates?${params.toString()}`)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    const updates: Record<string, string | null> = {}
    for (const key of [
      'q',
      'fpMin',
      'fpMax',
      'psMin',
      'psMax',
      'smMin',
      'smMax',
      'confidenceMin',
    ]) {
      updates[key] = (data.get(key) as string | null) ?? null
    }
    push(updates)
  }

  const activeCount = [...searchParams.keys()].filter(
    (k) => !['page', 'sort'].includes(k),
  ).length

  const exportHref = `/api/export?${searchParams.toString()}`

  return (
    <div className="mb-4 bg-[#0F172A] border border-[#1E293B] rounded-lg p-2.5 flex flex-col gap-2">
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
        <input
          ref={searchRef}
          name="q"
          defaultValue={get('q')}
          placeholder="search id, district or block   /"
          className="flex-1 min-w-[200px] bg-[#090D16] border border-[#1E293B] rounded px-2.5 py-1.5 text-[11px] font-mono text-[#F8FAFC] placeholder:text-[#475569] focus:outline-none focus:border-sky-500/60"
        />

        <select
          aria-label="District"
          value={get('district')}
          onChange={(e) => push({ district: e.target.value })}
          className={selectClass}
        >
          <option value="">district · all</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          aria-label="Block"
          value={get('block')}
          onChange={(e) => push({ block: e.target.value })}
          className={selectClass}
        >
          <option value="">block · all</option>
          {blocks.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <select
          aria-label="Stage"
          value={get('stage')}
          onChange={(e) => push({ stage: e.target.value })}
          className={selectClass}
        >
          <option value="">stage · all</option>
          {STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Persona"
          value={get('persona')}
          onChange={(e) => push({ persona: e.target.value })}
          className={selectClass}
        >
          <option value="">persona · all</option>
          {PERSONAS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Band"
          value={get('band')}
          onChange={(e) => push({ band: e.target.value, unscored: null })}
          className={selectClass}
        >
          <option value="">band · all</option>
          {BANDS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <select
          aria-label="Reviewer status"
          value={get('reviewerStatus')}
          onChange={(e) => push({ reviewerStatus: e.target.value })}
          className={selectClass}
        >
          <option value="">review · all</option>
          {REVIEWER_STATUSES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Flag type"
          value={get('flagType')}
          onChange={(e) => push({ flagType: e.target.value, hasFlags: null })}
          className={selectClass}
        >
          <option value="">flag · any</option>
          {FLAG_TYPES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Language"
          value={get('language')}
          onChange={(e) => push({ language: e.target.value })}
          className={selectClass}
        >
          <option value="">language · all</option>
          {languages.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <select
          aria-label="Registration status"
          value={get('registrationStatus')}
          onChange={(e) => push({ registrationStatus: e.target.value })}
          className={selectClass}
        >
          <option value="">registration · all</option>
          {REGISTRATION_STATUSES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        {questionSetVersions.length > 1 && (
          <select
            aria-label="Question set version"
            title="Scores from different question-set versions are not comparable"
            value={get('questionSetVersion')}
            onChange={(e) => push({ questionSetVersion: e.target.value })}
            className={selectClass}
          >
            <option value="">question set · all</option>
            {questionSetVersions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        )}

        <select
          aria-label="Sort"
          value={get('sort') || 'date_desc'}
          onChange={(e) => push({ sort: e.target.value })}
          className={selectClass}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              sort · {s.label}
            </option>
          ))}
        </select>

        <button type="submit" className="hidden" aria-hidden />
      </form>

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
        <button
          type="button"
          onClick={() => push({ unscored: get('unscored') === 'true' ? null : 'true', band: null })}
          data-active={get('unscored') === 'true'}
          className="px-2 py-1 rounded border border-slate-500/50 text-slate-300 hover:bg-slate-500/10 data-[active=true]:bg-slate-500/25 data-[active=true]:text-white"
        >
          unscored only
        </button>
        <button
          type="button"
          onClick={() => push({ needsHuman: get('needsHuman') === 'true' ? null : 'true' })}
          data-active={get('needsHuman') === 'true'}
          className="px-2 py-1 rounded border border-sky-500/50 text-sky-300 hover:bg-sky-500/10 data-[active=true]:bg-sky-500/25"
        >
          needs a human
        </button>
        <button
          type="button"
          onClick={() => push({ hasFlags: get('hasFlags') === 'true' ? null : 'true', flagType: null })}
          data-active={get('hasFlags') === 'true'}
          className="px-2 py-1 rounded border border-amber-500/50 text-amber-300 hover:bg-amber-500/10 data-[active=true]:bg-amber-500/25"
        >
          has flags
        </button>
        <button
          type="button"
          onClick={() => setShowScores((v) => !v)}
          className="px-2 py-1 rounded border border-[#334155] text-[#94A3B8] hover:bg-[#1E293B]"
        >
          {showScores ? 'hide' : 'show'} fit thresholds
        </button>

        <span className="ml-auto flex items-center gap-2">
          <span className="text-[#64748B]">
            {activeCount} filter{activeCount === 1 ? '' : 's'} · {total} rows
          </span>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => router.push('/candidates')}
              className="px-2 py-1 rounded border border-[#334155] text-[#64748B] hover:bg-[#1E293B]"
            >
              reset
            </button>
          )}
          <a
            href={exportHref}
            className="px-2 py-1 rounded border border-sky-500/50 text-sky-300 hover:bg-sky-500/10"
          >
            export this view ↓
          </a>
        </span>
      </div>

      {showScores && (
        <form
          onSubmit={onSubmit}
          className="flex flex-wrap items-end gap-3 border-t border-[#1E293B] pt-2.5 text-[11px] font-mono"
        >
          {[
            { prefix: 'fp', label: 'Founder–Problem' },
            { prefix: 'ps', label: 'Problem–Solution' },
            { prefix: 'sm', label: 'Solution–Market' },
          ].map(({ prefix, label }) => (
            <div key={prefix} className="flex flex-col gap-1">
              <span className="text-[#64748B]">{label}</span>
              <div className="flex items-center gap-1">
                <input
                  name={`${prefix}Min`}
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={get(`${prefix}Min`)}
                  placeholder="min"
                  className="w-16 bg-[#090D16] border border-[#1E293B] rounded px-1.5 py-1 text-[#F8FAFC] placeholder:text-[#475569] focus:outline-none focus:border-sky-500/60"
                />
                <span className="text-[#475569]">–</span>
                <input
                  name={`${prefix}Max`}
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={get(`${prefix}Max`)}
                  placeholder="max"
                  className="w-16 bg-[#090D16] border border-[#1E293B] rounded px-1.5 py-1 text-[#F8FAFC] placeholder:text-[#475569] focus:outline-none focus:border-sky-500/60"
                />
              </div>
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <span className="text-[#64748B]">Confidence ≥</span>
            <input
              name="confidenceMin"
              type="number"
              step="0.05"
              min={0}
              max={1}
              defaultValue={get('confidenceMin')}
              placeholder="0.00"
              className="w-20 bg-[#090D16] border border-[#1E293B] rounded px-1.5 py-1 text-[#F8FAFC] placeholder:text-[#475569] focus:outline-none focus:border-sky-500/60"
            />
          </div>
          <input type="hidden" name="q" value={get('q')} />
          <button
            type="submit"
            className="px-2.5 py-1.5 rounded border border-sky-500/50 text-sky-300 hover:bg-sky-500/10"
          >
            apply
          </button>
        </form>
      )}
    </div>
  )
}
