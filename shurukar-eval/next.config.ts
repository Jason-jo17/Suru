import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Emits .next/standalone with only the files the server needs, so the
  // runtime image does not carry node_modules or the build toolchain.
  output: 'standalone',
}

export default nextConfig
