import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Emits .next/standalone with only the files the server needs, so the
  // runtime image does not carry node_modules or the build toolchain.
  output: 'standalone',
  // The question sets are read from disk at runtime (their content hash is the
  // question_set_version), so they must ship with every serverless function.
  outputFileTracingIncludes: {
    '/**': ['./test/question-sets.json'],
  },
}

export default nextConfig
