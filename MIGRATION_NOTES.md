# Migration Notes

## Hardening pass — 2026-03-18

### Schema changes requiring a new migration

Run after pulling this commit:

```bash
pnpm db:migrate
# or in production:
pnpm db:migrate:deploy
```

### What changed

**New indexes added:**
- `RefreshToken`: `family`, `userId`, `expiresAt`
- `ApiKey`: `createdById`, `expiresAt`
- `StatusHistory`: `(entityType, entityId)`, `changedById`
- `ActivityLog`: `(entityType, entityId)`, `userId`, `createdAt`
- `Lead`: `status`, `assignedToId`

**New constraints:**
- `FeedbackRound`: `@@unique([projectId, roundNumber])` — prevents duplicate round numbers per project

**New relation:**
- `Lead.assignedToId` now has a proper FK to `User` via the `"AssignedLeads"` named relation

### Breaking changes

None. All changes are additive (indexes + constraints on valid data).

If any `FeedbackRound` rows violate the new unique constraint, the migration will fail.
Run this query before migrating to check:

```sql
SELECT "projectId", "roundNumber", COUNT(*)
FROM "FeedbackRound"
GROUP BY "projectId", "roundNumber"
HAVING COUNT(*) > 1;
```
