'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function KeyboardNav({ prevId, nextId }: { prevId: string | null, nextId: string | null }) {
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return

      if (e.key === 'j' && nextId) {
        router.push(`/candidates/${nextId}`)
      } else if (e.key === 'k' && prevId) {
        router.push(`/candidates/${prevId}`)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nextId, prevId, router])

  return null
}
