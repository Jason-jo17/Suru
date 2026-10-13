import { prisma } from '../src/lib/db'
import { assertAllMapped, normalizeRecord } from '../src/lib/ingest/fieldMap'
import { ingestCandidate } from '../src/lib/ingest/ingest'
import { readExport } from '../src/lib/ingest/readExport'

/** `--exclude-state KARNATAKA,GOA` (case-insensitive), repeatable. */
function excludedStates(argv: string[]): Set<string> {
  const out = new Set<string>()
  argv.forEach((arg, i) => {
    const value = arg.startsWith('--exclude-state=')
      ? arg.slice('--exclude-state='.length)
      : arg === '--exclude-state'
        ? argv[i + 1]
        : undefined
    for (const s of (value ?? '').split(',')) if (s.trim()) out.add(s.trim().toUpperCase())
  })
  return out
}

async function main() {
  const argv = process.argv.slice(2)
  const file = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--exclude-state')
  if (!file) {
    console.error('Usage: npm run ingest -- <file.json|file.csv> [--exclude-state KARNATAKA]')
    process.exit(1)
  }

  const excluded = excludedStates(argv)
  const all = readExport(file)
  const records = all.filter(
    (r) => !excluded.has((normalizeRecord(r).state ?? '').trim().toUpperCase()),
  )
  console.log(`Loaded ${all.length} records from ${file}.`)
  if (excluded.size > 0) {
    console.log(
      `Excluding state(s) ${[...excluded].join(', ')}: ${all.length - records.length} skipped, ` +
        `${records.length} to ingest.`,
    )
  }

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
