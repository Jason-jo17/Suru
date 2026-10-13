import fs from 'fs'
import path from 'path'
import type {
  Assessment,
  Candidate,
  Dossier,
  LayaRun,
  RawResponse,
  SeedBankRecord,
} from '@prisma/client'
import { prisma } from '../src/lib/db'

/**
 * Loads a file written by exportSnapshot into the database DATABASE_URL points
 * at — typically the deployed Postgres. Ids are kept, so links between
 * candidates, dossiers, runs and assessments survive the move intact.
 *
 *   node dist/scripts/importSnapshot.js snapshots/cohort.json            (container)
 *   npm run snapshot:import -- snapshots/cohort.json --replace           (local)
 *
 * Refuses to load into a database that already has candidates unless
 * --replace is given, which deletes everything first.
 */

interface Snapshot {
  exportedAt: string
  candidates: Candidate[]
  rawResponses: RawResponse[]
  seedBankRecords: SeedBankRecord[]
  dossiers: Dossier[]
  layaRuns: LayaRun[]
  assessments: Assessment[]
}

const DATE_FIELDS = ['createdAt', 'updatedAt', 'consentAt', 'reviewedAt']

/** JSON turned every DateTime into a string; Prisma wants them back as Dates. */
function revive<T extends object>(rows: T[]): T[] {
  return rows.map((row) => {
    const out = { ...row } as Record<string, unknown>
    for (const f of DATE_FIELDS) {
      if (typeof out[f] === 'string') out[f] = new Date(out[f] as string)
    }
    return out as unknown as T
  })
}

async function main() {
  const argv = process.argv.slice(2)
  const file = argv.find((a) => !a.startsWith('--'))
  if (!file) {
    console.error('Usage: importSnapshot <snapshot.json> [--replace]')
    process.exit(1)
  }
  const snap: Snapshot = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'))

  const existing = await prisma.candidate.count()
  if (existing > 0 && !argv.includes('--replace')) {
    console.error(
      `Target already has ${existing} candidates. Re-run with --replace to wipe it and load the snapshot.`,
    )
    process.exitCode = 1
    return
  }

  await prisma.$transaction(
    async (tx) => {
      // Children first on delete, parents first on insert.
      await tx.assessment.deleteMany()
      await tx.layaRun.deleteMany()
      await tx.dossier.deleteMany()
      await tx.seedBankRecord.deleteMany()
      await tx.rawResponse.deleteMany()
      await tx.candidate.deleteMany()

      await tx.candidate.createMany({ data: revive(snap.candidates) })
      await tx.rawResponse.createMany({ data: revive(snap.rawResponses) })
      await tx.seedBankRecord.createMany({ data: revive(snap.seedBankRecords) })
      await tx.dossier.createMany({ data: revive(snap.dossiers) })
      await tx.layaRun.createMany({ data: revive(snap.layaRuns) })
      await tx.assessment.createMany({ data: revive(snap.assessments) })
    },
    { timeout: 300_000 },
  )

  console.log(
    `Loaded ${snap.candidates.length} candidates, ${snap.assessments.length} assessments ` +
      `(snapshot from ${snap.exportedAt}).`,
  )
}

main()
  .catch((err) => {
    console.error(`Import failed: ${(err as Error).message}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
