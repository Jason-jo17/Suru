/**
 * Bundles the CLI scripts to plain JS for the container image.
 *
 * The runtime image carries no TypeScript toolchain, so `tsx` is not there to
 * run scripts/*.ts. Bundling them here means ingest and scoring can be run
 * against the live database from inside the container, which is the whole
 * point of deploying the pipeline rather than just the UI.
 */
import { build } from 'esbuild'

await build({
  entryPoints: [
    'scripts/ingest.ts',
    'scripts/runPipeline.ts',
    'scripts/acceptance.ts',
  ],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outdir: 'dist/scripts',
  // Prisma ships native query engines and resolves them relative to its own
  // package, so it must stay external and be copied into the image as-is.
  external: ['@prisma/client', '.prisma/client', 'prisma'],
  logLevel: 'info',
})
