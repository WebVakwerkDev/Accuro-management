#!/bin/sh
# Run this once after first startup to seed the database with sample data.
# Usage: docker compose exec web sh scripts/seed-db.sh
set -e

echo "[seed] Seeding database..."
npx tsx prisma/seed.ts
echo "[seed] Done."
