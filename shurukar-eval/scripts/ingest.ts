import fs from 'fs'
import path from 'path'
import { ingestCandidate } from '../src/lib/ingest/ingest'
import { parse } from 'csv-parse/sync'

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: npm run ingest -- <file.json|file.csv>')
    process.exit(1)
  }

  const absolutePath = path.resolve(process.cwd(), file)
  const content = fs.readFileSync(absolutePath, 'utf8')
  
  let records: any[] = []
  
  if (file.endsWith('.json')) {
    records = JSON.parse(content)
  } else if (file.endsWith('.csv')) {
    records = parse(content, { columns: true, skip_empty_lines: true })
  } else {
    console.error('Only .json and .csv files are supported')
    process.exit(1)
  }

  console.log(`Loaded ${records.length} records.`)

  let success = 0
  let idx = 1
  for (const record of records) {
    try {
      // using name + index as a pseudo external id for the test data
      const externalId = record.name ? `${record.name.replace(/\s+/g, '-').toLowerCase()}-${idx}` : `cand-${idx}`
      await ingestCandidate(record, externalId)
      success++
    } catch (e) {
      console.error(`Failed to ingest record ${idx}:`, (e as Error).message)
    }
    idx++
  }

  console.log(`Ingested ${success}/${records.length} records.`)
}

main().catch(console.error)
