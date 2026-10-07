'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function updateReviewerDecision(candidateId: string, decision: 'advance' | 'hold' | 'needs_info') {
  try {
    const assessment = await prisma.assessment.findFirst({
      where: { candidateId },
      orderBy: { createdAt: 'desc' }
    })

    if (!assessment) {
      return { success: false, error: 'No assessment found for this candidate' }
    }

    await prisma.assessment.update({
      where: { id: assessment.id },
      data: { reviewerDecision: decision }
    })

    revalidatePath(`/candidates/${candidateId}`)
    revalidatePath('/candidates')

    return { success: true, decision }
  } catch (error: any) {
    console.error('Failed to update reviewer decision:', error)
    return { success: false, error: error.message }
  }
}
