'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, FormEvent, useEffect, useRef } from 'react'

export default function Filters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  const [district, setDistrict] = useState(searchParams.get('district') || '')
  const [stage, setStage] = useState(searchParams.get('stage') || '')
  const [band, setBand] = useState(searchParams.get('band') || '')
  const [reviewerStatus, setReviewerStatus] = useState(searchParams.get('reviewerStatus') || '')
  const [unscored, setUnscored] = useState(searchParams.get('unscored') === 'true')
  const [hasFlags, setHasFlags] = useState(searchParams.get('hasFlags') === 'true')

  // Global hotkey to focus search bar with '/'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const applyFilters = (overrides: Record<string, any> = {}) => {
    const params = new URLSearchParams()
    
    const d = overrides.district !== undefined ? overrides.district : district
    const s = overrides.stage !== undefined ? overrides.stage : stage
    const b = overrides.band !== undefined ? overrides.band : band
    const rs = overrides.reviewerStatus !== undefined ? overrides.reviewerStatus : reviewerStatus
    const u = overrides.unscored !== undefined ? overrides.unscored : unscored
    const f = overrides.hasFlags !== undefined ? overrides.hasFlags : hasFlags

    if (d) params.set('district', d)
    if (s) params.set('stage', s)
    if (b) params.set('band', b)
    if (rs) params.set('reviewerStatus', rs)
    if (u) params.set('unscored', 'true')
    if (f) params.set('hasFlags', 'true')
    
    router.push(`/candidates?${params.toString()}`)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    applyFilters()
  }

  const handleReset = () => {
    setDistrict('')
    setStage('')
    setBand('')
    setReviewerStatus('')
    setUnscored(false)
    setHasFlags(false)
    router.push('/candidates')
  }

  const activeFiltersCount = [
    district, stage, band, reviewerStatus, unscored, hasFlags
  ].filter(Boolean).length

  return (
    <div className="mb-4 bg-[#0F172A] border border-[#1E293B] rounded-lg p-2.5 shadow-sm">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 text-xs">
        {/* Search District / Block */}
        <div className="relative flex-1 min-w-[200px]">
          <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-[#64748B]">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input 
            ref={searchInputRef}
            type="text" 
            value={district} 
            onChange={e => setDistrict(e.target.value)} 
            placeholder="Search district, block... (Press '/' to focus)" 
            className="w-full bg-[#111827] border border-[#1E293B] rounded pl-8 pr-12 py-1.5 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-sky-500 font-mono"
          />
          <div className="absolute inset-y-0 right-2 flex items-center">
            <kbd>/</kbd>
          </div>
        </div>

        {/* Stage Filter */}
        <div className="flex items-center bg-[#111827] border border-[#1E293B] rounded px-2 py-1">
          <span className="text-[#64748B] mr-1.5 font-medium">Stage:</span>
          <select 
            value={stage} 
            onChange={e => { setStage(e.target.value); applyFilters({ stage: e.target.value }) }} 
            className="bg-transparent text-white focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-[#111827]">All</option>
            <option value="idea" className="bg-[#111827]">Idea (A)</option>
            <option value="built" className="bg-[#111827]">Built (B)</option>
            <option value="in_market" className="bg-[#111827]">In Market (C)</option>
          </select>
        </div>

        {/* Band Filter */}
        <div className="flex items-center bg-[#111827] border border-[#1E293B] rounded px-2 py-1">
          <span className="text-[#64748B] mr-1.5 font-medium">Band:</span>
          <select 
            value={band} 
            onChange={e => { setBand(e.target.value); applyFilters({ band: e.target.value }) }} 
            className="bg-transparent text-white focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-[#111827]">All</option>
            <option value="strong" className="bg-[#111827]">Strong</option>
            <option value="promising" className="bg-[#111827]">Promising</option>
            <option value="early" className="bg-[#111827]">Early</option>
          </select>
        </div>

        {/* Reviewer Status */}
        <div className="flex items-center bg-[#111827] border border-[#1E293B] rounded px-2 py-1">
          <span className="text-[#64748B] mr-1.5 font-medium">Review:</span>
          <select 
            value={reviewerStatus} 
            onChange={e => { setReviewerStatus(e.target.value); applyFilters({ reviewerStatus: e.target.value }) }} 
            className="bg-transparent text-white focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-[#111827]">All</option>
            <option value="unreviewed" className="bg-[#111827]">Unreviewed</option>
            <option value="advance" className="bg-[#111827]">Advance</option>
            <option value="hold" className="bg-[#111827]">Hold</option>
            <option value="needs_info" className="bg-[#111827]">Needs Info</option>
          </select>
        </div>

        {/* Unscored Toggle Button */}
        <button
          type="button"
          onClick={() => { const val = !unscored; setUnscored(val); applyFilters({ unscored: val }) }}
          className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition-colors ${
            unscored 
              ? 'bg-sky-500/10 border-sky-500 text-sky-400 font-medium' 
              : 'bg-[#111827] border-[#1E293B] text-[#94A3B8] hover:border-[#334155]'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${unscored ? 'bg-sky-400' : 'bg-[#64748B]'}`} />
          Unscored Only
        </button>

        {/* Flags Toggle Button */}
        <button
          type="button"
          onClick={() => { const val = !hasFlags; setHasFlags(val); applyFilters({ hasFlags: val }) }}
          className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition-colors ${
            hasFlags 
              ? 'bg-rose-500/10 border-rose-500 text-rose-400 font-medium' 
              : 'bg-[#111827] border-[#1E293B] text-[#94A3B8] hover:border-[#334155]'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${hasFlags ? 'bg-rose-400' : 'bg-[#64748B]'}`} />
          Flags Only
        </button>

        {/* Clear Filters (if active) */}
        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={handleReset}
            className="px-2 py-1 text-[#64748B] hover:text-white transition-colors underline"
          >
            Reset ({activeFiltersCount})
          </button>
        )}

        {/* Export CSV Button */}
        <a 
          href={`/api/export?${searchParams.toString()}`} 
          className="ml-auto px-3 py-1 bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20 transition-colors rounded font-medium flex items-center gap-1.5"
          download
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </a>
      </form>
    </div>
  )
}
