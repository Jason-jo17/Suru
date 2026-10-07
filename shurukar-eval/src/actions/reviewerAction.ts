'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'

export type ReviewerDecision = 'advance' | 'hold' | 'needs_info'

const DECISIONS: ReviewerDecision[] = ['advance', 'hold', 'needs_info']

/**
 * Records a reviewer's call.
 *
 * This is the calibration set. Thresholds come from comparing these decisions
 * against the model's bands, so the note and the reviewer are stored alongside
 * the decision — a decision with no note cannot be re-read six months later.
 */
export async function updateReviewerDecision(
  candidateId: string,
  decision: ReviewerDecision | null,
  note?: string,
  reviewedBy?: string,
): Promise<{ success: boolean; error?: string }> {
  if (decision !== null && !DECISIONS.includes(decision)) {
    return { success: false, error: `Unknown decision: ${decision}` }
  }

  try {
    const assessment = await prisma.assessment.findFirst({
      where: { candidateId, isLatest: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!assessment) {
      return { success: false, error: 'No assessment found for this candidate' }
    }

    await prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        reviewerDecision: decision,
        // An empty note must not wipe one that is already there.
        reviewerNote: note !== undefined && note.trim() !== '' ? note.trim() : assessment.reviewerNote,
        reviewedBy: reviewedBy?.trim() || assessment.reviewedBy || 'unattributed',
        reviewedAt: decision === null ? null : new Date(),
      },
    })

    revalidatePath(`/candidates/${candidateId}`)
    revalidatePath('/candidates')
    return { success: true }
  } catch (error) {
    console.error('Failed to record reviewer decision:', error)
    return { success: false, error: (error as Error).message }
  }
}

/** Saves a note without taking a decision, so a reviewer can park a thought. */
export async function saveReviewerNote(
  candidateId: string,
  note: string,
  reviewedBy?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const assessment = await prisma.assessment.findFirst({
      where: { candidateId, isLatest: true },
      orderBy: { createdAt: 'desc' },
    })
    if (!assessment) return { success: false, error: 'No assessment found for this candidate' }

    await prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        reviewerNote: note.trim() === '' ? null : note.trim(),
        reviewedBy: reviewedBy?.trim() || assessment.reviewedBy,
      },
    })
    revalidatePath(`/candidates/${candidateId}`)
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}
