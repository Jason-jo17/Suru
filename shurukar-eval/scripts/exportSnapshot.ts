import fs from 'fs'
import path from 'path'
import { prisma } from '../src/lib/db'

/**
 * Writes the whole evaluation database to one JSON file, so a cohort scored
 * locally (SQLite) can be loaded into the deployed database (Postgres) with
 * importSnapshot — without calling Laya a second time.
 *
 *   npm run snapshot:export -- snapshots/cohort.json
 *
 * The file holds founders' names and answers. It is gitignored; move it the way
 * you would move the database itself.
 */
async function main() {
  const out = path.resolve(process.cwd(), process.argv[2] || 'snapshots/snapshot.json')
  fs.mkdirSync(path.dirname(out), { recursive: true })

  const snapshot = {
    exportedAt: new Date().toISOString(),
    candidates: await prisma.candidate.findMany(),
    rawResponses: await prisma.rawResponse.findMany(),
    seedBankRecords: await prisma.seedBankRecord.findMany(),
    dossiers: await prisma.dossier.findMany(),
    layaRuns: await prisma.layaRun.findMany(),
    assessments: await prisma.assessment.findMany(),
  }

  fs.writeFileSync(out, JSON.stringify(snapshot))
  const counts = Object.entries(snapshot)
    .filter(([, v]) => Array.isArray(v))
    .map(([k, v]) => `${(v as unknown[]).length} ${k}`)
  console.log(`Wrote ${out}\n  ${counts.join(', ')}`)
}

main()
  .catch((err) => {
    console.error(`Export failed: ${(err as Error).message}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
