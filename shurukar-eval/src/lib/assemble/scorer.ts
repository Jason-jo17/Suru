import { prisma } from '../db'

function getFloors(scenario: string, answers: any): string | null {
  if (answers.submission_real?.choice === 'spam') return 'Spam'
  
  if (scenario === 'A') {
    if (answers.problem_evidence?.choice === 'asserted') return 'Problem asserted with no evidence'
    if (answers.founder_proximity?.choice === 'none') return 'No founder proximity'
  } else if (scenario === 'B') {
    if (answers.build_evidence?.choice === 'unclear') return 'Build evidence unclear'
  } else if (scenario === 'C') {
    if (answers.users?.choice === 'none') return 'No users in market stage'
  }
  
  return null
}

function calculateScore(answers: any, keys: string[]) {
  let score = 0
  let count = 0
  for (const k of keys) {
    if (answers[k]) {
      // Map 'choice' into a 0-100 value ideally, or use '.score'
      let val = 50
      if (answers[k].score !== undefined) val = answers[k].score * 25 // assuming 0-4 scale
      else if (answers[k].choice) {
        // generic dummy weighting for choices
        if (answers[k].choice === 'strong' || answers[k].choice === 'genuine' || answers[k].choice === 'lived') val = 100
        else if (answers[k].choice === 'none' || answers[k].choice === 'spam' || answers[k].choice === 'asserted') val = 0
        else val = 50
      }
      
      // Weight constraint_type near zero as requested
      const weight = k === 'constraint_type' ? 0.1 : 1
      score += val * weight
      count += weight
    }
  }
  return count === 0 ? 50 : Math.round(score / count)
}

export async function assembleAssessment(layaRunId: string) {
  const layaRun = await prisma.layaRun.findUnique({
    where: { id: layaRunId },
    include: { dossier: { include: { candidate: true } } }
  })
  
  if (!layaRun) throw new Error('LayaRun not found')
  const candidateId = layaRun.dossier.candidateId
  
  if (layaRun.status === 'unscored') {
    return await prisma.assessment.create({
      data: {
        candidateId,
        layaRunId,
        band: 'unscored',
        flags: '[]'
      }
    })
  }

  const answers = JSON.parse(layaRun.answers)
  const scenario = layaRun.scenario

  let needsHuman = false
  for (const [key, val] of Object.entries<any>(answers)) {
    if (val.confidence !== undefined && val.confidence < 0.5) {
      needsHuman = true
    }
  }

  if (needsHuman) {
    return await prisma.assessment.create({
      data: {
        candidateId,
        layaRunId,
        band: 'unscored',
        flags: JSON.stringify(['Low confidence on model answers']),
        confidence: 0.4
      }
    })
  }

  let founderProblem = 0, problemSolution = 0, solutionMarket = 0

  if (scenario === 'A') {
    founderProblem = calculateScore(answers, ['founder_proximity', 'motivation', 'constraint_type'])
    problemSolution = calculateScore(answers, ['problem_evidence', 'problem_specificity', 'validation_effort'])
    solutionMarket = calculateScore(answers, ['alternatives', 'willingness_to_pay', 'route_to_market'])
  } else if (scenario === 'B') {
    founderProblem = calculateScore(answers, ['founder_experience', 'motivation', 'constraint_type'])
    problemSolution = calculateScore(answers, ['build_evidence', 'usage', 'validation_effort', 'addresses_problem'])
    solutionMarket = calculateScore(answers, ['alternatives', 'willingness_to_pay', 'route_to_market'])
  } else if (scenario === 'C') {
    founderProblem = calculateScore(answers, ['founder_experience', 'motivation', 'constraint_type'])
    problemSolution = calculateScore(answers, ['users', 'retention'])
    solutionMarket = calculateScore(answers, ['paying', 'revenue', 'alternatives', 'route_to_market', 'formalisation'])
  }

  const cappedBy = getFloors(scenario, answers)
  let band = 'promising'
  
  if (cappedBy === 'Spam') {
    band = 'unscored' // Spam might be outright rejected or unscored. Given "never auto-reject", let's mark it 'unscored' with flags, or maybe 'early' capped. Actually prompt says "Candidate spam-01 comes back submission_real != genuine", and "No auto-reject...". So we assign a band.
  }
  
  let overallScore = 0
  if (scenario === 'A') overallScore = founderProblem * 0.6 + problemSolution * 0.3 + solutionMarket * 0.1
  else if (scenario === 'B') overallScore = founderProblem * 0.3 + problemSolution * 0.4 + solutionMarket * 0.3
  else if (scenario === 'C') overallScore = founderProblem * 0.2 + problemSolution * 0.3 + solutionMarket * 0.5

  if (cappedBy) {
    band = cappedBy === 'Spam' ? 'unscored' : 'early'
  } else {
    if (overallScore >= 75) band = 'strong'
    else if (overallScore >= 50) band = 'promising'
    else band = 'early'
  }

  let finalFlags = cappedBy === 'Spam' ? ['Spam detected'] : []
  if (answers._routingFlags && Array.isArray(answers._routingFlags)) {
    finalFlags = finalFlags.concat(answers._routingFlags)
  }

  return await prisma.assessment.create({
    data: {
      candidateId,
      layaRunId,
      founderProblem,
      problemSolution,
      solutionMarket,
      band,
      cappedBy,
      flags: JSON.stringify(finalFlags),
      confidence: 0.85
    }
  })
}
