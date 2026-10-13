import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Emits .next/standalone with only the files the server needs, so the
  // runtime image does not carry node_modules or the build toolchain.
  output: 'standalone',
  // This app lives in a subfolder of the repo; without this, Next guesses the
  // workspace root from any lockfile further up the tree and traces from there.
  outputFileTracingRoot: process.cwd(),
  // The question sets are read from disk at runtime (their content hash is the
  // question_set_version), so they must ship with every serverless function.
  outputFileTracingIncludes: {
    '/**': ['./test/question-sets.json'],
  },
}

export default nextConfig
