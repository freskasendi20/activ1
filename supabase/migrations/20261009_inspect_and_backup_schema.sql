-- ==============================================================================
-- NEXA STORE - PRE-MIGRATION INSPECTION & SAFE BACKUP SCRIPT
-- Project Reference: uyscsaqkvrkpokjmzasf
-- READ-ONLY / NON-DESTRUCTIVE AUDIT SCRIPT
-- Run this script first to inspect existing database tables, row counts,
-- and create an isolated archive schema (nexo_backup_schema) before any cleanup.
-- ==============================================================================

-- 1. INSPECT EXISTING TABLES IN PUBLIC SCHEMA
SELECT 
    table_schema,
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. INSPECT EXISTING CUSTOM TYPES (ENUMS)
SELECT 
    t.typname AS enum_name,
    n.nspname AS schema_name
FROM pg_type t 
JOIN pg_namespace n ON t.typnamespace = n.oid 
WHERE n.nspname = 'public' AND t.typtype = 'e';

-- 3. INSPECT EXISTING FUNCTIONS IN PUBLIC SCHEMA
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- 4. CREATE AN ISOLATED BACKUP SCHEMA FOR ANY EXISTING DATA
CREATE SCHEMA IF NOT EXISTS nexo_previous_app_backup;

-- Function to safely backup all existing public tables into nexo_previous_app_backup
DO $$
DECLARE
    tbl RECORD;
    target_count INT := 0;
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
            EXECUTE format('CREATE TABLE IF NOT EXISTS nexo_previous_app_backup.%I AS SELECT * FROM public.%I;', tbl.table_name, tbl.table_name);
            RAISE NOTICE 'Backed up table: public.% to nexo_previous_app_backup.%', tbl.table_name, tbl.table_name;
            target_count := target_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not backup table: % (Error: %)', tbl.table_name, SQLERRM;
        END;
    END LOOP;
    RAISE NOTICE 'Total tables backed up: %', target_count;
END $$;

-- 5. VERIFY BACKUP INTEGRITY
SELECT 
    table_schema,
    table_name,
    (xpath('/row/cnt/text()', xml_count))[1]::text::int AS approximate_row_count
FROM (
    SELECT 
        table_schema,
        table_name,
        query_to_xml(format('SELECT count(*) AS cnt FROM %I.%I', table_schema, table_name), false, true, '') AS xml_count
    FROM information_schema.tables
    WHERE table_schema = 'nexo_previous_app_backup'
) sub
ORDER BY table_name;
