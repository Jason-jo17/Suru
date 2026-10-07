#!/bin/sh
set -e

# The provider line is rewritten from DATABASE_URL before anything touches the
# database, so one schema serves Postgres in a container and SQLite locally.
node scripts/setDbProvider.mjs

if [ "${RUN_DB_PUSH:-1}" = "1" ]; then
  echo "[entrypoint] syncing schema"
  node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss
fi

exec "$@"
