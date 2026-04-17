# Database migrations

Hand-rolled SQL migrations for the Haibo Postgres database. The schema
source of truth is [`shared/schema.ts`](../shared/schema.ts) — these files
are what you actually run against the database.

## Apply a migration

```bash
# Against the Azure production DB (use Query Editor or psql):
psql "$DATABASE_URL" -f migrations/0001_role_system_foundation.sql

# Against a local dev DB:
psql "$LOCAL_DATABASE_URL" -f migrations/0001_role_system_foundation.sql
```

Every migration is wrapped in `BEGIN; ... COMMIT;` so it applies atomically.
If any statement fails, the whole migration rolls back and you're left in
the pre-migration state.

## Rollback

If a migration causes problems, each has a companion `_down.sql`:

```bash
psql "$DATABASE_URL" -f migrations/0001_role_system_foundation_down.sql
```

**Rollbacks are destructive** — they drop columns and tables added in the
forward migration. Prefer writing a follow-up forward migration that
corrects the issue rather than rolling back on production.

## Generating with Drizzle

We hand-write these files instead of relying on `drizzle-kit generate` because:
- Hand-written SQL is easier to review (one file shows exactly what
  runs on the DB, no diff-noise from ordering).
- Comments in the SQL document *why* each change was made — Drizzle-generated
  migrations are bare `ALTER TABLE` statements with no context.
- Data backfills (e.g. setting `link_status='active'` for pre-existing
  drivers) belong in the same atomic migration as the schema change — that's
  awkward to express through Drizzle's generator.

If you want to use `drizzle-kit generate` for a future change, be sure to
review the generated SQL and add the same BEGIN/COMMIT wrapping + comments
before committing.

## Migrations log

| # | File | Purpose | Applied |
|---|------|---------|---------|
| 0001 | `0001_role_system_foundation.sql` | Role system (driver/owner/vendor), fareBalance, owner invitations | — |
