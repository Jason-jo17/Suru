import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'

/**
 * Reads a CSV, TSV or JSON intake export into rows of header -> value.
 * Headers are returned exactly as the export spells them; mapping them to
 * stable field ids is the field map's job.
 */
export function readExport(file: string): Record<string, string>[] {
  const absolute = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file)
  const content = fs.readFileSync(absolute, 'utf8')

  if (file.endsWith('.json')) {
    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of records')
    return parsed as Record<string, string>[]
  }
  if (file.endsWith('.csv') || file.endsWith('.tsv')) {
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      delimiter: file.endsWith('.tsv') ? '\t' : ',',
      bom: true,
    }) as Record<string, string>[]
  }
  throw new Error('Only .json, .csv and .tsv exports are supported')
}
