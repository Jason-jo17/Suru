import { prisma } from '../src/lib/db'
import { assertAllMapped } from '../src/lib/ingest/fieldMap'
import { ingestCandidate } from '../src/lib/ingest/ingest'
import { readExport } from '../src/lib/ingest/readExport'

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: npm run ingest -- <file.json|file.csv>')
    process.exit(1)
  }

  const records = readExport(file)
  console.log(`Loaded ${records.length} records from ${file}.`)

  // Validate every header across every row BEFORE writing anything. A dropped
  // column looks identical to an unanswered question, so a bad export must fail
  // the whole import rather than half-load it.
  const headers = new Set<string>()
  for (const record of records) for (const key of Object.keys(record)) headers.add(key)
  assertAllMapped([...headers])
  console.log(`All ${headers.size} columns map to a stable field id.`)

  let stored = 0
  let seedComplete = 0
  for (let i = 0; i < records.length; i++) {
    const result = await ingestCandidate(records[i], i + 1)
    stored++
    if (result.seedBankComplete) seedComplete++
    console.log(
      `  ${result.candidate.externalId.padEnd(16)} ${String(result.fieldsStored).padStart(2)} fields` +
        `  seed-bank: ${result.seedBankComplete ? 'complete' : 'incomplete'}`,
    )
  }

  console.log(`\nIngested ${stored}/${records.length}. SEED Bank complete for ${seedComplete}.`)
}

main()
  .catch((err) => {
    console.error(`\nIngest failed: ${(err as Error).message}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
