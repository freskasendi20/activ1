-- ==============================================================================
-- NEXA STORE - PRODUCT DELIVERY CONFIGURATION MIGRATION
-- Migration: 20261012_product_delivery_configuration.sql
-- Status: PREPARED FOR OWNER REVIEW / NOT APPLIED YET
-- Purpose: Minimal additive columns for owner-controlled delivery methods,
--          required customer information fields, and plain-Arabic explanations.
-- ==============================================================================

-- 1. Add delivery configuration columns to public.products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'email';

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS required_fields JSONB DEFAULT '["recipient_email"]'::jsonb;

-- 2. Add optional delivery configuration columns to public.product_variants
-- (Allows variant-specific delivery methods if duration/tier requires it)
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS delivery_method TEXT;

ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS required_fields JSONB;

-- 3. Update view admin_products if it exists to include the new columns
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'admin_products'
    ) THEN
        -- Safely recreate admin_products view with new additive columns
        CREATE OR REPLACE VIEW public.admin_products AS
        SELECT 
            p.*,
            COALESCE(p.delivery_method, 'email') AS computed_delivery_method,
            COALESCE(p.required_fields, '["recipient_email"]'::jsonb) AS computed_required_fields
        FROM public.products p;
    END IF;
END $$;

-- 4. Comments for documentation and audit
COMMENT ON COLUMN public.products.delivery_method IS 'Owner-configured delivery channel: email, recipient_email, whatsapp, code, or custom';
COMMENT ON COLUMN public.products.required_fields IS 'Array of required customer input field identifiers for checkout: recipient_email, whatsapp_phone, activation_email, etc.';
COMMENT ON COLUMN public.product_variants.delivery_method IS 'Optional variant-specific delivery channel override';
COMMENT ON COLUMN public.product_variants.required_fields IS 'Optional variant-specific required customer input fields override';
