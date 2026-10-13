/**
 * Sets the Prisma datasource provider from DATABASE_URL.
 *
 * Prisma will not take env() for a provider, and the deployed app runs on
 * Postgres while local work and the acceptance suite run on SQLite. Rather than
 * keep two schema files and let them drift, the single schema's provider line
 * is rewritten from the connection string before `prisma generate`.
 *
 * Run by `prebuild`, so a deploy picks it up with no extra step.
 */
import fs from 'fs'
import path from 'path'

const SCHEMA = path.resolve(process.cwd(), 'prisma/schema.prisma')

/**
 * The real environment wins (Vercel, Docker). A plain `npm run build` has no
 * dotenv loaded yet, so fall back to DATABASE_URL in .env — otherwise a local
 * build generates a SQLite client while the app connects to Postgres.
 */
function fromDotenv() {
  const file = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(file)) return ''
  const line = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .find((l) => /^\s*DATABASE_URL\s*=/.test(l))
  return line ? line.replace(/^\s*DATABASE_URL\s*=\s*/, '').trim().replace(/^["']|["']$/g, '') : ''
}

const url = process.env.DATABASE_URL || fromDotenv()
const provider = /^postgres(ql)?:\/\//.test(url)
  ? 'postgresql'
  : /^mysql:\/\//.test(url)
    ? 'mysql'
    : 'sqlite'

const schema = fs.readFileSync(SCHEMA, 'utf8')
const updated = schema.replace(
  /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"[^"]*"/s,
  `$1"${provider}"`,
)

if (updated !== schema) {
  fs.writeFileSync(SCHEMA, updated)
  console.log(`[db] provider set to ${provider}`)
} else {
  console.log(`[db] provider already ${provider}`)
}
