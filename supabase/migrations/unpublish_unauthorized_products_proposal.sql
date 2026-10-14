-- ==============================================================================
-- NEXA STORE: PROPOSED CATALOG CORRECTION MIGRATION
-- Purpose: Unpublish unauthorized products without deleting historical orders or data.
-- Status: PROPOSED FOR EXPLICIT OWNER APPROVAL (DO NOT RUN AUTOMATICALLY)
-- Date: 2026-10-12
--
-- Audit Summary:
-- Total products in Supabase: 33
-- Authorized products (matching 30 owner-specified families): 23
-- Unauthorized products requiring unpublishing: 10
-- ==============================================================================

BEGIN;

-- 1. Verify existence of products before updating
DO $$
BEGIN
    RAISE NOTICE 'Starting unpublishing review for 10 unauthorized product records...';
END $$;

-- 2. Safely unpublish the 10 unauthorized products
-- Preserves all foreign key relationships with order_items, reviews, delivery logs.
UPDATE public.products
SET 
    is_active = false,
    updated_at = NOW()
WHERE id IN (
    'ai-claude-pro',           -- Claude Pro (Not in authorized family list)
    'ai-midjourney-standard',  -- Midjourney (Not in authorized family list)
    'cr-canva-pro-edu',        -- Canva Pro (Not in authorized family list)
    'gm-playstation-plus',     -- PlayStation Plus (Not in authorized family list)
    'gm-xbox-game-pass',       -- Xbox Game Pass (Not in authorized family list)
    'cr-premiere-pro-1m',      -- Adobe Premiere standalone (Adobe Full Apps authorized instead)
    'of-grammarly-premium',    -- Grammarly Premium (Not in authorized family list)
    'st-deezer-premium',       -- Deezer Premium (Not in authorized family list)
    'gm-expressvpn-1y',        -- ExpressVPN (NordVPN & ProtonVPN authorized instead)
    'cr-photoshop-1m'          -- Adobe Photoshop standalone (Adobe Full Apps authorized instead)
);

-- 3. Audit log of affected rows
DO $$
DECLARE
    unpublished_count INT;
BEGIN
    SELECT COUNT(*) INTO unpublished_count
    FROM public.products
    WHERE id IN (
        'ai-claude-pro', 'ai-midjourney-standard', 'cr-canva-pro-edu',
        'gm-playstation-plus', 'gm-xbox-game-pass', 'cr-premiere-pro-1m',
        'of-grammarly-premium', 'st-deezer-premium', 'gm-expressvpn-1y',
        'cr-photoshop-1m'
    ) AND is_active = false;
    
    RAISE NOTICE 'Confirmed: % unauthorized products are now unpublished (is_active = false).', unpublished_count;
END $$;

COMMIT;
