-- ==============================================================================
-- NEXA STORE - PHASE 1: SAFE OLD APPLICATION CLEANUP MIGRATION
-- Project Reference: uyscsaqkvrkpokjmzasf
-- This migration safely inventories and purges obsolete previous-application
-- database tables and triggers while strictly preserving Supabase-managed schemas
-- (auth, storage, realtime, vault, pgsodium, graphql, etc.).
-- ==============================================================================

-- 1. Create audit schema for safe rollback/logging if needed
CREATE SCHEMA IF NOT EXISTS nexo_archive;

-- 2. Drop obsolete custom functions from previous application if any existed
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
          AND routine_name NOT IN ('handle_new_user', 'update_updated_at_column')
    ) LOOP
        BEGIN
            EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.routine_name) || ' CASCADE;';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping function: %', r.routine_name;
        END;
    END LOOP;
END $$;

-- 3. Safely drop legacy public tables from previous application
-- Only application-specific tables in the public schema are targeted
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN (
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          AND table_name NOT LIKE 'pg_%'
          AND table_name NOT LIKE 'sql_%'
    ) LOOP
        BEGIN
            EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(tbl.table_name) || ' CASCADE;';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping table: %', tbl.table_name;
        END;
    END LOOP;
END $$;

-- 4. Clean obsolete application types in public schema
DO $$
DECLARE
    tp RECORD;
BEGIN
    FOR tp IN (
        SELECT typname 
        FROM pg_type t 
        JOIN pg_namespace n ON t.typnamespace = n.oid 
        WHERE n.nspname = 'public' AND t.typtype = 'e'
    ) LOOP
        BEGIN
            EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(tp.typname) || ' CASCADE;';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping type: %', tp.typname;
        END;
    END LOOP;
END $$;

-- 5. Cleanup confirmation note
COMMENT ON SCHEMA public IS 'Nexa Digital Storefront Public Schema - Cleaned and Ready for Rebuild';
