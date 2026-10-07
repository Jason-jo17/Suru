import fs from 'fs'
import path from 'path'
import { prisma } from '../db'

export async function scoreDossier(dossierId: string) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: { candidate: true }
  })
  if (!dossier) throw new Error('Dossier not found')
  
  const candidate = dossier.candidate
  
  let scenario = 'A'
  let flagsToAppend: string[] = []
  
  if (candidate.declaredStage === 'built') {
    scenario = 'B'
  } else if (candidate.declaredStage === 'in_market') {
    const payload = JSON.parse(dossier.payload)
    const paying = payload.paying_customers?.toLowerCase() || ''
    const users = payload.users_count?.toLowerCase() || ''
    
    // Contradiction detection
    const isZeroPaying = paying === '0' || paying === 'none' || paying === 'zero'
    const isFewUsers = users === '1-5' || users === '1 to 5' || users === '1 - 5'
    
    if (isZeroPaying || isFewUsers) {
      scenario = 'B'
      flagsToAppend.push('Market contradiction: routed to built due to low/zero traction')
    } else {
      scenario = 'C'
    }
  }

  const qSetsStr = fs.readFileSync(path.resolve(process.cwd(), 'test/question-sets.json'), 'utf8')
  const qSets = JSON.parse(qSetsStr)
  const questions = qSets[scenario]
  
  const questionSetVersion = 'v1.0'
  const modelCheckpoint = candidate.language !== 'english' ? 'convaiinnovations/laya-multilingual' : 'default'
  const state = JSON.parse(dossier.payload)

  const apiKey = process.env.LAYA_API_KEY
  if (!apiKey) {
    return await prisma.layaRun.create({
      data: {
        dossierId,
        scenario,
        questionSetVersion,
        modelCheckpoint,
        questionsSent: JSON.stringify(questions),
        answers: '{}',
        status: 'unscored',
        error: 'LAYA_API_KEY not set'
      }
    })
  }

  const start = Date.now()
  let attempts = 0
  let res: Response | null = null
  
  while (attempts < 3) {
    attempts++
    try {
      res = await fetch('https://autoextract.theboringpeople.in/api/laya/v1/systemone', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ state, questions, model: modelCheckpoint })
      })

      if (res.status === 503) {
        // Backoff and retry
        await new Promise(resolve => setTimeout(resolve, attempts * 5000))
        continue
      }
      
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After')
        const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 10000
        await new Promise(resolve => setTimeout(resolve, waitMs))
        continue
      }
      
      if (res.status === 401) {
        console.error('[Laya] API Key invalid/expired (401). Alerting and aborting.')
        throw new Error('401 Unauthorized')
      }
      
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`)
      }
      
      break // success
    } catch (err: any) {
      if (err.message === '401 Unauthorized') throw err
      if (attempts >= 3) throw err
    }
  }

  if (!res || !res.ok) {
    throw new Error('Max retries exceeded or failed response')
  }

  try {
    const data = await res.json()
    const latencyMs = Date.now() - start
    
    const finalAnswers = data.answers || {}
    if (flagsToAppend.length > 0) {
      finalAnswers._routingFlags = flagsToAppend
    }

    return await prisma.layaRun.create({
      data: {
        dossierId,
        scenario,
        questionSetVersion,
        modelCheckpoint,
        questionsSent: JSON.stringify(questions),
        answers: JSON.stringify(finalAnswers),
        status: 'scored',
        latencyMs
      }
    })
  } catch (err) {
    return await prisma.layaRun.create({
      data: {
        dossierId,
        scenario,
        questionSetVersion,
        modelCheckpoint,
        questionsSent: JSON.stringify(questions),
        answers: '{}',
        status: 'unscored',
        error: (err as Error).message,
        latencyMs: Date.now() - start
      }
    })
  }
}
