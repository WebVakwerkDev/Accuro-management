#!/bin/sh
set -e

echo "[start-web] Running database migrations..."
npx prisma migrate deploy

echo "[start-web] Starting Next.js server..."
exec node server.js
