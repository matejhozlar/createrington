-- ADD VALUE is fine here because nothing in this batch uses the value; a
-- later migration that backfills with 'manifest' must recreate the type
-- instead (see 0038), since drizzle applies pending migrations in one
-- transaction
ALTER TYPE "public"."mod_environment_source" ADD VALUE 'manifest' BEFORE 'manual';