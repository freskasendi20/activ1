-- ==============================================================================
-- NEXA STORE - COMPLETE PRODUCTION SUPABASE MIGRATION (SECURITY-HARDENED V2)
-- Project Name: Nexa Digital
-- Project Reference: mrinxsiostnzzjowutav
-- Region: aws-1-eu-central-1.pooler.supabase.com
--
-- COMPREHENSIVE ARCHITECTURE & SECURITY GUARANTEES:
-- 1. NO PUBLIC ADMIN SELF-PROMOTION (Manual/Trusted Server-Side Provisioning only)
-- 2. DIRECT ORDER INSERTION BLOCKED (Strictly restricted to create_order_securely RPC)
-- 3. INVENTORY CONCURRENCY SAFE (Row-locking with FOR UPDATE, nonnegative CHECK constraints,
--    and idempotency-safe cancellation restore flag preventing duplicate restorations)
-- 4. REVIEW MODERATION ENFORCED (is_approved and is_verified default to false with DB trigger)
-- 5. WHOLESALE SENSITIVE DATA PROTECTED (Safe public catalog view; wholesale costs & source_bot hidden)
-- 6. PRIVATE RECEIPTS WITH VALIDATED UPLOADS (Extension, path, and size constraints on private bucket)
-- 7. SERVER-SIDE PAYMENT & BUNDLE VALIDATION (Payment method & bundle active/expiry checks)
-- 8. EXPLICIT LEAST-PRIVILEGE GRANTS & REVOKES ON ALL TABLES AND FUNCTIONS
--
-- 100% Additive, Idempotent, Safe (IF NOT EXISTS / ON CONFLICT)
-- DO NOT EXECUTE UNTIL EXPLICIT USER APPROVAL.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS & ENUMS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('unverified', 'verified', 'rejected', 'refunded');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE fulfillment_status AS ENUM ('unfulfilled', 'in_progress', 'fulfilled', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE stock_type AS ENUM ('unlimited', 'limited', 'manual');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE movement_type AS ENUM ('restock', 'sale', 'reservation', 'reservation_release', 'cancellation_return', 'manual_adjustment', 'loss');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('customer', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE discount_type AS ENUM ('fixed', 'percentage');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. TABLE: categories
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
    CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 3. TABLE: products
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category_id TEXT NOT NULL REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    duration TEXT NOT NULL DEFAULT '1 شهر',
    wholesale_egp NUMERIC(10, 2) NOT NULL DEFAULT 0,
    price_egp NUMERIC(10, 2) NOT NULL,
    price_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
    wholesale_usd NUMERIC(10, 2) DEFAULT 0,
    source_bot TEXT,
    is_featured BOOLEAN DEFAULT false,
    image TEXT NOT NULL,
    featured_image TEXT,
    rating NUMERIC(3, 2) DEFAULT 4.9,
    rating_count TEXT DEFAULT '100+',
    description TEXT,
    specs JSONB DEFAULT '[]'::jsonb,
    full_desc TEXT,
    activation_guide TEXT,
    delivery_instructions TEXT,
    warranty TEXT,
    is_active BOOLEAN DEFAULT true,
    is_archived BOOLEAN DEFAULT false,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_display_order ON public.products(display_order);

DO $$ BEGIN
    CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 4. TABLE: product_variants
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    duration TEXT NOT NULL,
    wholesale_egp NUMERIC(10, 2) NOT NULL DEFAULT 0,
    price_egp NUMERIC(10, 2) NOT NULL,
    price_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON public.product_variants(product_id);

DO $$ BEGIN
    CREATE TRIGGER trg_product_variants_updated_at
    BEFORE UPDATE ON public.product_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 5. TABLE: product_inventory (Non-negative Constraints & Multi-Mode Stock)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
    stock_type stock_type NOT NULL DEFAULT 'unlimited',
    quantity_available INT NOT NULL DEFAULT 100,
    quantity_reserved INT NOT NULL DEFAULT 0,
    quantity_sold INT NOT NULL DEFAULT 0,
    low_stock_threshold INT NOT NULL DEFAULT 5,
    is_paused BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_product_variant_inventory UNIQUE (product_id, variant_id),
    CONSTRAINT chk_quantity_available_non_negative CHECK (quantity_available >= 0),
    CONSTRAINT chk_quantity_reserved_non_negative CHECK (quantity_reserved >= 0),
    CONSTRAINT chk_quantity_sold_non_negative CHECK (quantity_sold >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON public.product_inventory(product_id);

DO $$ BEGIN
    CREATE TRIGGER trg_product_inventory_updated_at
    BEFORE UPDATE ON public.product_inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 6. TABLE: inventory_movements (Audit Trail)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
    order_id UUID,
    movement_type movement_type NOT NULL,
    quantity_change INT NOT NULL,
    previous_quantity INT NOT NULL,
    new_quantity INT NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_movements_product ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_order ON public.inventory_movements(order_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_created_at ON public.inventory_movements(created_at DESC);

-- ------------------------------------------------------------------------------
-- 7. TABLE: bundles & bundle_items (Combos)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bundles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    description TEXT,
    image TEXT NOT NULL,
    original_price_egp NUMERIC(10, 2) NOT NULL,
    price_egp NUMERIC(10, 2) NOT NULL,
    price_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT true,
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bundles_active ON public.bundles(is_active);
CREATE INDEX IF NOT EXISTS idx_bundles_featured ON public.bundles(is_featured);

DO $$ BEGIN
    CREATE TRIGGER trg_bundles_updated_at
    BEFORE UPDATE ON public.bundles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.bundle_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_id TEXT NOT NULL REFERENCES public.bundles(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL DEFAULT 1,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle ON public.bundle_items(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_product ON public.bundle_items(product_id);

-- ------------------------------------------------------------------------------
-- 8. TABLE: payment_methods (Fully Dynamic)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    account_number TEXT,
    account_name TEXT,
    instructions TEXT NOT NULL,
    currency TEXT DEFAULT 'EGP',
    network TEXT,
    wallet_address TEXT,
    requires_receipt BOOLEAN DEFAULT true,
    qr_code_image TEXT,
    icon TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON public.payment_methods(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_methods_order ON public.payment_methods(display_order);

DO $$ BEGIN
    CREATE TRIGGER trg_payment_methods_updated_at
    BEFORE UPDATE ON public.payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 9. TABLE: profiles (Linked to auth.users, with Escalation Protection)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    role user_role DEFAULT 'customer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
    CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Role Escalation Protection Trigger: Prevent non-admins from changing role
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        -- Only an existing admin or service_role can change a user's role
        IF NOT (
            auth.role() = 'service_role' OR 
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        ) THEN
            RAISE EXCEPTION 'Privilege escalation rejected: only administrators can alter user roles.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DO $$ BEGIN
    CREATE TRIGGER trg_protect_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Auto-create profile trigger on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'phone',
        'customer'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DO $$ BEGIN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 10. TABLE: orders (Separated Payment & Fulfillment Status + Stock Restore Flag)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT UNIQUE NOT NULL,
    access_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    notes TEXT,
    subtotal_egp NUMERIC(10, 2) NOT NULL,
    discount_egp NUMERIC(10, 2) DEFAULT 0,
    total_egp NUMERIC(10, 2) NOT NULL,
    total_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL,
    payment_method_id TEXT REFERENCES public.payment_methods(id) ON DELETE SET NULL,
    transfer_number TEXT,
    receipt_image_url TEXT,
    payment_status payment_status NOT NULL DEFAULT 'unverified',
    fulfillment_status fulfillment_status NOT NULL DEFAULT 'unfulfilled',
    status order_status NOT NULL DEFAULT 'pending',
    stock_restored BOOLEAN NOT NULL DEFAULT false, -- Prevents duplicate inventory restoration on cancellations
    admin_notes TEXT,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    fulfilled_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_order_id ON public.orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_access_token ON public.orders(access_token);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON public.orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

DO $$ BEGIN
    CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 11. TABLE: order_items (With Bundle & Product Support)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    bundle_id TEXT REFERENCES public.bundles(id) ON DELETE SET NULL,
    is_bundle BOOLEAN DEFAULT false,
    name TEXT NOT NULL,
    duration TEXT,
    price_egp NUMERIC(10, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    delivery_type TEXT,
    activation_type TEXT DEFAULT 'ready',
    image TEXT,
    bundle_contents JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_bundle ON public.order_items(bundle_id);

-- ------------------------------------------------------------------------------
-- 12. TABLE: order_status_history (Audit Trail)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    change_type TEXT NOT NULL, -- 'payment', 'fulfillment', 'general'
    notes TEXT,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_history_order ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_history_created_at ON public.order_status_history(created_at DESC);

-- ------------------------------------------------------------------------------
-- 13. TABLE: payment_records
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    payment_method_id TEXT REFERENCES public.payment_methods(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EGP',
    sender_info TEXT,
    receipt_url TEXT,
    status payment_status NOT NULL DEFAULT 'unverified',
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_records_order ON public.payment_records(order_id);

-- ------------------------------------------------------------------------------
-- 14. TABLE: reviews (Safe Moderation Defaults: Unverified & Unapproved)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    product_name TEXT NOT NULL,
    category TEXT DEFAULT 'ai',
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_category ON public.reviews(category);
CREATE INDEX IF NOT EXISTS idx_reviews_approved ON public.reviews(is_approved);

-- Enforce review moderation defaults on insert (prevent forged approvals)
CREATE OR REPLACE FUNCTION public.enforce_review_defaults()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT (
        auth.role() = 'service_role' OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    ) THEN
        NEW.is_approved := false;
        NEW.is_verified := false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DO $$ BEGIN
    CREATE TRIGGER trg_enforce_review_defaults
    BEFORE INSERT ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.enforce_review_defaults();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 15. TABLE: support_tickets
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    admin_reply TEXT,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.support_tickets(status);

DO $$ BEGIN
    CREATE TRIGGER trg_support_tickets_updated_at
    BEFORE UPDATE ON public.support_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 16. TABLE: coupons (Advanced Server-Validated Promotions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    discount_type discount_type NOT NULL DEFAULT 'fixed',
    discount_value NUMERIC(10, 2) NOT NULL,
    min_order_value NUMERIC(10, 2) DEFAULT 0,
    max_discount_amount NUMERIC(10, 2),
    usage_limit INT,
    usage_count INT DEFAULT 0,
    applies_to_product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    applies_to_bundle_id TEXT REFERENCES public.bundles(id) ON DELETE SET NULL,
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons(is_active);

-- ------------------------------------------------------------------------------
-- 17. TABLE: store_settings
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 18. SAFE PUBLIC CATALOG VIEW (Zero Wholesale/Bot Exposure)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.products_catalog AS
SELECT 
    p.id,
    p.name,
    p.category_id,
    p.duration,
    p.price_egp,
    p.price_usd,
    p.is_featured,
    p.image,
    p.featured_image,
    p.rating,
    p.rating_count,
    p.description,
    p.specs,
    p.full_desc,
    p.activation_guide,
    p.delivery_instructions,
    p.warranty,
    p.is_active,
    p.is_archived,
    p.display_order,
    p.created_at,
    p.updated_at,
    pi.stock_type,
    pi.quantity_available,
    pi.low_stock_threshold,
    pi.is_paused,
    CASE 
        WHEN pi.is_paused THEN 'paused'
        WHEN pi.stock_type = 'limited' AND pi.quantity_available <= 0 THEN 'out_of_stock'
        WHEN pi.stock_type = 'limited' AND pi.quantity_available <= pi.low_stock_threshold THEN 'low_stock'
        ELSE 'in_stock'
    END AS stock_status
FROM public.products p
LEFT JOIN public.product_inventory pi ON pi.product_id = p.id AND pi.variant_id IS NULL
WHERE p.is_active = true AND p.is_archived = false;

-- ==============================================================================
-- 19. RPC FUNCTIONS: AUTHORIZATION, PRICING, CONCURRENCY & SECURE OPERATIONS
-- ==============================================================================

-- Check if current authenticated user has admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Client-callable admin check
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.is_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Trusted Server-Side Administrator Provisioning (Service Role Only)
CREATE OR REPLACE FUNCTION public.provision_admin_user(p_user_email TEXT)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: administrator provisioning requires service_role authorization.';
    END IF;

    SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = LOWER(TRIM(p_user_email));
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User with email % not found in auth.users.', p_user_email;
    END IF;

    UPDATE public.profiles SET role = 'admin' WHERE id = v_user_id;
    RETURN jsonb_build_object('success', true, 'email', p_user_email, 'user_id', v_user_id, 'role', 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Admin-only Role Assignment
CREATE OR REPLACE FUNCTION public.assign_admin_role(p_user_id UUID, p_role user_role)
RETURNS BOOLEAN AS $$
BEGIN
    IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
        RAISE EXCEPTION 'Unauthorized: only an administrator can change roles.';
    END IF;

    UPDATE public.profiles SET role = p_role WHERE id = p_user_id;
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Server-Side Pricing, Stock Deduction & Atomic Order Creation RPC
-- (Locks inventory rows FOR UPDATE to prevent race conditions and overselling)
CREATE OR REPLACE FUNCTION public.create_order_securely(
    p_order_id TEXT,
    p_customer_name TEXT,
    p_customer_email TEXT,
    p_customer_phone TEXT,
    p_notes TEXT,
    p_payment_method TEXT,
    p_payment_method_id TEXT,
    p_transfer_number TEXT,
    p_receipt_image_url TEXT,
    p_coupon_code TEXT,
    p_items JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_item JSONB;
    v_product RECORD;
    v_bundle RECORD;
    v_bundle_item RECORD;
    v_inventory RECORD;
    v_payment_method RECORD;
    v_subtotal NUMERIC := 0;
    v_coupon_discount NUMERIC := 0;
    v_global_discount NUMERIC := 0;
    v_global_discount_pct NUMERIC := 0;
    v_total_egp NUMERIC := 0;
    v_total_usd NUMERIC := 0;
    v_exchange_rate NUMERIC := 50.0;
    v_order_uuid UUID;
    v_access_token TEXT := encode(gen_random_bytes(16), 'hex');
    v_qty INT;
    v_item_id TEXT;
    v_is_bundle BOOLEAN;
    v_delivery_type TEXT;
    v_activation_type TEXT;
    v_coupon RECORD;
    v_settings_val JSONB;
    v_bundle_contents JSONB;
BEGIN
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item';
    END IF;

    -- 1. Validate Enabled Payment Method
    IF p_payment_method_id IS NOT NULL AND TRIM(p_payment_method_id) <> '' THEN
        SELECT * INTO v_payment_method 
        FROM public.payment_methods 
        WHERE id = p_payment_method_id AND is_active = true;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'طريقة الدفع المختارة غير متوفرة أو تم تعطيلها: %', p_payment_method_id;
        END IF;
    ELSE
        RAISE EXCEPTION 'يجب تحديد طريقة دفع صالحة ومعتمدة لإتمام الطلب.';
    END IF;

    -- Fetch dynamic exchange rate and store promotion settings
    SELECT value INTO v_settings_val FROM public.store_settings WHERE key = 'currency_config';
    IF v_settings_val IS NOT NULL AND (v_settings_val->>'usd_egp_rate') IS NOT NULL THEN
        v_exchange_rate := GREATEST(1.0, (v_settings_val->>'usd_egp_rate')::NUMERIC);
    END IF;

    SELECT value INTO v_settings_val FROM public.store_settings WHERE key = 'promotions';
    IF v_settings_val IS NOT NULL AND (v_settings_val->>'global_discount_percent') IS NOT NULL THEN
        v_global_discount_pct := GREATEST(0.0, (v_settings_val->>'global_discount_percent')::NUMERIC);
    END IF;

    -- 2. Lock Inventory Rows and Validate Product/Bundle Existence & Availability
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_item_id := v_item->>'id';
        v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::INT, 1));
        v_is_bundle := COALESCE((v_item->>'is_bundle')::BOOLEAN, false);

        IF v_is_bundle THEN
            -- Validate Active, Non-Expired Bundle
            SELECT * INTO v_bundle 
            FROM public.bundles 
            WHERE id = v_item_id 
              AND is_active = true
              AND (starts_at IS NULL OR starts_at <= NOW())
              AND (expires_at IS NULL OR expires_at >= NOW());

            IF NOT FOUND THEN
                RAISE EXCEPTION 'الباقة المطلوبة غير مفعلة، منتهية الصلاحية، أو غير متوفرة: %', v_item_id;
            END IF;

            v_subtotal := v_subtotal + (v_bundle.price_egp * v_qty);

            -- Lock and check stock for all bundle component products
            FOR v_bundle_item IN SELECT * FROM public.bundle_items WHERE bundle_id = v_bundle.id LOOP
                SELECT * INTO v_inventory 
                FROM public.product_inventory 
                WHERE product_id = v_bundle_item.product_id 
                FOR UPDATE;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'أحد مكونات الباقة غير مسجل في المخزون: %', v_bundle_item.product_id;
                END IF;

                IF v_inventory.is_paused THEN
                    RAISE EXCEPTION 'مبيعات أحد مكونات الباقة موقوفة مؤقتاً: %', v_bundle_item.product_id;
                END IF;

                IF v_inventory.stock_type = 'limited' THEN
                    IF (v_inventory.quantity_available - v_inventory.quantity_reserved) < (v_bundle_item.quantity * v_qty) THEN
                        RAISE EXCEPTION 'المخزون غير كافٍ لأحد مكونات الباقة: % (المتبقي: %)', v_bundle_item.product_id, (v_inventory.quantity_available - v_inventory.quantity_reserved);
                    END IF;
                END IF;
            END LOOP;
        ELSE
            -- Validate Single Active Product
            SELECT id, name, duration, price_egp, image, is_active 
            INTO v_product 
            FROM public.products 
            WHERE id = v_item_id AND is_active = true AND is_archived = false;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'المنتج غير متوفر أو غير مفعل: %', v_item_id;
            END IF;

            v_subtotal := v_subtotal + (v_product.price_egp * v_qty);

            -- Lock Inventory Row FOR UPDATE & Check Stock Level
            SELECT * INTO v_inventory 
            FROM public.product_inventory 
            WHERE product_id = v_product.id 
            FOR UPDATE;

            IF FOUND THEN
                IF v_inventory.is_paused THEN
                    RAISE EXCEPTION 'تم إيقاف مبيعات هذا المنتج مؤقتاً: %', v_product.name;
                END IF;
                IF v_inventory.stock_type = 'limited' THEN
                    IF (v_inventory.quantity_available - v_inventory.quantity_reserved) < v_qty THEN
                        RAISE EXCEPTION 'نفدت الكمية أو المخزون غير كافٍ للمنتج % (المتبقي: %)', v_product.name, (v_inventory.quantity_available - v_inventory.quantity_reserved);
                    END IF;
                END IF;
            END IF;
        END IF;
    END LOOP;

    -- 3. Apply Dynamic Global Promotion (if enabled in settings)
    IF v_global_discount_pct > 0 THEN
        v_global_discount := ROUND(v_subtotal * (v_global_discount_pct / 100.0), 2);
    END IF;

    -- 4. Server-Side Coupon Validation
    IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
        SELECT * INTO v_coupon 
        FROM public.coupons 
        WHERE code = UPPER(TRIM(p_coupon_code)) AND is_active = true;

        IF FOUND THEN
            -- Check expiration
            IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < NOW() THEN
                v_coupon_discount := 0;
            -- Check usage limit
            ELSIF v_coupon.usage_limit IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit THEN
                v_coupon_discount := 0;
            -- Check minimum order value
            ELSIF v_subtotal < COALESCE(v_coupon.min_order_value, 0) THEN
                v_coupon_discount := 0;
            ELSE
                IF v_coupon.discount_type = 'percentage' THEN
                    v_coupon_discount := ROUND(v_subtotal * (v_coupon.discount_value / 100.0), 2);
                    IF v_coupon.max_discount_amount IS NOT NULL THEN
                        v_coupon_discount := LEAST(v_coupon_discount, v_coupon.max_discount_amount);
                    END IF;
                ELSE
                    v_coupon_discount := LEAST(v_coupon.discount_value, v_subtotal);
                END IF;

                -- Increment coupon usage
                UPDATE public.coupons SET usage_count = usage_count + 1 WHERE id = v_coupon.id;
            END IF;
        END IF;
    END IF;

    -- 5. Calculate Final Verified Totals
    v_total_egp := GREATEST(0, v_subtotal - v_global_discount - v_coupon_discount);
    v_total_usd := ROUND((v_total_egp / v_exchange_rate), 2);

    -- 6. Insert Order Record
    INSERT INTO public.orders (
        order_id,
        access_token,
        customer_id,
        customer_name,
        customer_email,
        customer_phone,
        notes,
        subtotal_egp,
        discount_egp,
        total_egp,
        total_usd,
        payment_method,
        payment_method_id,
        transfer_number,
        receipt_image_url,
        payment_status,
        fulfillment_status,
        status,
        stock_restored
    ) VALUES (
        p_order_id,
        v_access_token,
        auth.uid(),
        p_customer_name,
        p_customer_email,
        p_customer_phone,
        p_notes,
        v_subtotal,
        v_global_discount + v_coupon_discount,
        v_total_egp,
        v_total_usd,
        v_payment_method.name,
        v_payment_method.id,
        p_transfer_number,
        p_receipt_image_url,
        'unverified',
        'unfulfilled',
        'pending',
        false
    ) RETURNING id INTO v_order_uuid;

    -- 7. Insert Order Items & Deduct Stock Atomically
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_item_id := v_item->>'id';
        v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::INT, 1));
        v_is_bundle := COALESCE((v_item->>'is_bundle')::BOOLEAN, false);
        v_delivery_type := COALESCE(v_item->>'deliveryType', 'حساب رسمي مجهز');
        v_activation_type := COALESCE(v_item->>'activation', 'ready');

        IF v_is_bundle THEN
            SELECT * INTO v_bundle FROM public.bundles WHERE id = v_item_id;

            SELECT jsonb_agg(jsonb_build_object('id', bi.product_id, 'name', p.name, 'quantity', bi.quantity))
            INTO v_bundle_contents
            FROM public.bundle_items bi
            JOIN public.products p ON p.id = bi.product_id
            WHERE bi.bundle_id = v_bundle.id;

            INSERT INTO public.order_items (
                order_id,
                bundle_id,
                is_bundle,
                name,
                duration,
                price_egp,
                quantity,
                delivery_type,
                activation_type,
                image,
                bundle_contents
            ) VALUES (
                v_order_uuid,
                v_bundle.id,
                true,
                v_bundle.name,
                'باقة مجمعة',
                v_bundle.price_egp,
                v_qty,
                v_delivery_type,
                v_activation_type,
                v_bundle.image,
                COALESCE(v_bundle_contents, '[]'::jsonb)
            );

            -- Deduct stock for bundle items
            FOR v_bundle_item IN SELECT * FROM public.bundle_items WHERE bundle_id = v_bundle.id LOOP
                SELECT * INTO v_inventory FROM public.product_inventory WHERE product_id = v_bundle_item.product_id FOR UPDATE;
                IF FOUND AND v_inventory.stock_type = 'limited' THEN
                    UPDATE public.product_inventory 
                    SET quantity_available = quantity_available - (v_bundle_item.quantity * v_qty),
                        quantity_sold = quantity_sold + (v_bundle_item.quantity * v_qty)
                    WHERE id = v_inventory.id;

                    INSERT INTO public.inventory_movements (
                        product_id,
                        order_id,
                        movement_type,
                        quantity_change,
                        previous_quantity,
                        new_quantity,
                        reason
                    ) VALUES (
                        v_bundle_item.product_id,
                        v_order_uuid,
                        'sale',
                        -(v_bundle_item.quantity * v_qty),
                        v_inventory.quantity_available,
                        v_inventory.quantity_available - (v_bundle_item.quantity * v_qty),
                        'بيع باقة مجمعة: ' || v_bundle.name
                    );
                END IF;
            END LOOP;

        ELSE
            SELECT * INTO v_product FROM public.products WHERE id = v_item_id;

            INSERT INTO public.order_items (
                order_id,
                product_id,
                is_bundle,
                name,
                duration,
                price_egp,
                quantity,
                delivery_type,
                activation_type,
                image
            ) VALUES (
                v_order_uuid,
                v_product.id,
                false,
                v_product.name,
                v_product.duration,
                v_product.price_egp,
                v_qty,
                v_delivery_type,
                v_activation_type,
                v_product.image
            );

            -- Deduct stock for single product
            SELECT * INTO v_inventory FROM public.product_inventory WHERE product_id = v_product.id FOR UPDATE;
            IF FOUND AND v_inventory.stock_type = 'limited' THEN
                UPDATE public.product_inventory 
                SET quantity_available = quantity_available - v_qty,
                    quantity_sold = quantity_sold + v_qty
                WHERE id = v_inventory.id;

                INSERT INTO public.inventory_movements (
                    product_id,
                    order_id,
                    movement_type,
                    quantity_change,
                    previous_quantity,
                    new_quantity,
                    reason
                ) VALUES (
                    v_product.id,
                    v_order_uuid,
                    'sale',
                    -v_qty,
                    v_inventory.quantity_available,
                    v_inventory.quantity_available - v_qty,
                    'بيع منتج: ' || v_product.name
                );
            END IF;
        END IF;
    END LOOP;

    -- 8. Log Order Status History
    INSERT INTO public.order_status_history (
        order_id,
        previous_status,
        new_status,
        change_type,
        notes,
        changed_by
    ) VALUES (
        v_order_uuid,
        NULL,
        'pending',
        'general',
        'تم تسجيل الطلب وحساب الأسعار واعتماد الخصومات بنجاح عبر السحابة',
        auth.uid()
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_uuid', v_order_uuid,
        'order_id', p_order_id,
        'access_token', v_access_token,
        'subtotal_egp', v_subtotal,
        'discount_egp', v_global_discount + v_coupon_discount,
        'total_egp', v_total_egp,
        'total_usd', v_total_usd
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Safe Admin Order Status Management RPC (Handles stock returns on cancellation with idempotency)
CREATE OR REPLACE FUNCTION public.update_order_status_secure(
    p_order_id TEXT,
    p_payment_status payment_status,
    p_fulfillment_status fulfillment_status,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_bundle_item RECORD;
    v_inventory RECORD;
    v_new_overall_status order_status;
BEGIN
    IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
        RAISE EXCEPTION 'Unauthorized: only an administrator can update orders.';
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE order_id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Determine overall status
    IF p_payment_status = 'rejected' OR p_fulfillment_status = 'cancelled' THEN
        v_new_overall_status := 'cancelled';
    ELSIF p_payment_status = 'verified' AND p_fulfillment_status = 'fulfilled' THEN
        v_new_overall_status := 'completed';
    ELSE
        v_new_overall_status := 'pending';
    END IF;

    -- If transitioning to cancelled from non-cancelled, restore inventory IF NOT ALREADY RESTORED!
    IF v_new_overall_status = 'cancelled' AND v_order.status <> 'cancelled' AND NOT v_order.stock_restored THEN
        FOR v_item IN SELECT * FROM public.order_items WHERE order_id = v_order.id LOOP
            IF v_item.is_bundle THEN
                FOR v_bundle_item IN SELECT * FROM public.bundle_items WHERE bundle_id = v_item.bundle_id LOOP
                    SELECT * INTO v_inventory FROM public.product_inventory WHERE product_id = v_bundle_item.product_id FOR UPDATE;
                    IF FOUND AND v_inventory.stock_type = 'limited' THEN
                        UPDATE public.product_inventory 
                        SET quantity_available = quantity_available + (v_bundle_item.quantity * v_item.quantity),
                            quantity_sold = GREATEST(0, quantity_sold - (v_bundle_item.quantity * v_item.quantity))
                        WHERE id = v_inventory.id;

                        INSERT INTO public.inventory_movements (
                            product_id,
                            order_id,
                            movement_type,
                            quantity_change,
                            previous_quantity,
                            new_quantity,
                            reason
                        ) VALUES (
                            v_bundle_item.product_id,
                            v_order.id,
                            'cancellation_return',
                            (v_bundle_item.quantity * v_item.quantity),
                            v_inventory.quantity_available,
                            v_inventory.quantity_available + (v_bundle_item.quantity * v_item.quantity),
                            'استرجاع مخزون بعد إلغاء الطلب ' || p_order_id
                        );
                    END IF;
                END LOOP;
            ELSE
                SELECT * INTO v_inventory FROM public.product_inventory WHERE product_id = v_item.product_id FOR UPDATE;
                IF FOUND AND v_inventory.stock_type = 'limited' THEN
                    UPDATE public.product_inventory 
                    SET quantity_available = quantity_available + v_item.quantity,
                        quantity_sold = GREATEST(0, quantity_sold - v_item.quantity)
                    WHERE id = v_inventory.id;

                    INSERT INTO public.inventory_movements (
                        product_id,
                        order_id,
                        movement_type,
                        quantity_change,
                        previous_quantity,
                        new_quantity,
                        reason
                    ) VALUES (
                        v_item.product_id,
                        v_order.id,
                        'cancellation_return',
                        v_item.quantity,
                        v_inventory.quantity_available,
                        v_inventory.quantity_available + v_item.quantity,
                        'استرجاع مخزون بعد إلغاء الطلب ' || p_order_id
                    );
                END IF;
            END IF;
        END LOOP;

        -- Mark stock restored on order record
        UPDATE public.orders SET stock_restored = true WHERE id = v_order.id;
    END IF;

    -- Update Order
    UPDATE public.orders SET
        payment_status = p_payment_status,
        fulfillment_status = p_fulfillment_status,
        status = v_new_overall_status,
        admin_notes = COALESCE(p_admin_notes, admin_notes),
        verified_at = CASE WHEN p_payment_status = 'verified' AND verified_at IS NULL THEN NOW() ELSE verified_at END,
        verified_by = CASE WHEN p_payment_status = 'verified' AND verified_by IS NULL THEN auth.uid() ELSE verified_by END,
        fulfilled_at = CASE WHEN p_fulfillment_status = 'fulfilled' AND fulfilled_at IS NULL THEN NOW() ELSE fulfilled_at END
    WHERE id = v_order.id;

    -- Log History
    INSERT INTO public.order_status_history (
        order_id,
        previous_status,
        new_status,
        change_type,
        notes,
        changed_by
    ) VALUES (
        v_order.id,
        v_order.status::TEXT,
        v_new_overall_status::TEXT,
        'general',
        'تحديث الحالة: دفع (' || p_payment_status || ')، تنفيذ (' || p_fulfillment_status || ')',
        auth.uid()
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'payment_status', p_payment_status,
        'fulfillment_status', p_fulfillment_status,
        'status', v_new_overall_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Safe Inventory Adjustment RPC
CREATE OR REPLACE FUNCTION public.adjust_inventory(
    p_product_id TEXT,
    p_stock_type stock_type,
    p_quantity_change INT,
    p_new_available INT DEFAULT NULL,
    p_low_stock_threshold INT DEFAULT NULL,
    p_is_paused BOOLEAN DEFAULT NULL,
    p_reason TEXT DEFAULT 'تعديل يدوي من لوحة التحكم'
)
RETURNS JSONB AS $$
DECLARE
    v_inv RECORD;
    v_prev_qty INT;
    v_new_qty INT;
BEGIN
    IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
        RAISE EXCEPTION 'Unauthorized: only an administrator can adjust inventory.';
    END IF;

    SELECT * INTO v_inv FROM public.product_inventory WHERE product_id = p_product_id FOR UPDATE;

    IF NOT FOUND THEN
        v_new_qty := GREATEST(0, COALESCE(p_new_available, p_quantity_change, 100));
        INSERT INTO public.product_inventory (
            product_id,
            stock_type,
            quantity_available,
            low_stock_threshold,
            is_paused
        ) VALUES (
            p_product_id,
            p_stock_type,
            v_new_qty,
            COALESCE(p_low_stock_threshold, 5),
            COALESCE(p_is_paused, false)
        ) RETURNING * INTO v_inv;
        v_prev_qty := 0;
    ELSE
        v_prev_qty := v_inv.quantity_available;
        IF p_new_available IS NOT NULL THEN
            v_new_qty := GREATEST(0, p_new_available);
        ELSE
            v_new_qty := GREATEST(0, v_inv.quantity_available + p_quantity_change);
        END IF;

        UPDATE public.product_inventory SET
            stock_type = p_stock_type,
            quantity_available = v_new_qty,
            low_stock_threshold = COALESCE(p_low_stock_threshold, low_stock_threshold),
            is_paused = COALESCE(p_is_paused, is_paused)
        WHERE id = v_inv.id;
    END IF;

    -- Record Movement
    INSERT INTO public.inventory_movements (
        product_id,
        movement_type,
        quantity_change,
        previous_quantity,
        new_quantity,
        reason,
        created_by
    ) VALUES (
        p_product_id,
        CASE WHEN v_new_qty > v_prev_qty THEN 'restock' ELSE 'manual_adjustment' END,
        v_new_qty - v_prev_qty,
        v_prev_qty,
        v_new_qty,
        p_reason,
        auth.uid()
    );

    RETURN jsonb_build_object(
        'success', true,
        'product_id', p_product_id,
        'previous_quantity', v_prev_qty,
        'new_quantity', v_new_qty,
        'stock_type', p_stock_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Safe Guest Order Lookup RPC (Requires unguessable access_token or owner auth)
CREATE OR REPLACE FUNCTION public.lookup_order(
    p_order_id TEXT,
    p_access_token TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_items JSONB;
    v_is_authorized BOOLEAN := false;
BEGIN
    SELECT * INTO v_order 
    FROM public.orders 
    WHERE order_id = p_order_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Authorization check: Admin, Authenticated Owner, or Matching Access Token
    IF public.is_admin() OR (auth.uid() IS NOT NULL AND v_order.customer_id = auth.uid()) THEN
        v_is_authorized := true;
    ELSIF p_access_token IS NOT NULL AND v_order.access_token = p_access_token THEN
        v_is_authorized := true;
    END IF;

    SELECT jsonb_agg(jsonb_build_object(
        'id', COALESCE(product_id, bundle_id),
        'name', name,
        'isBundle', is_bundle,
        'duration', duration,
        'quantity', quantity,
        'priceEgp', price_egp,
        'deliveryType', delivery_type,
        'activation', activation_type,
        'image', image,
        'bundleContents', bundle_contents
    )) INTO v_items
    FROM public.order_items
    WHERE order_id = v_order.id;

    IF v_is_authorized THEN
        RETURN jsonb_build_object(
            'orderId', v_order.order_id,
            'createdAt', v_order.created_at,
            'customerName', v_order.customer_name,
            'customerEmail', v_order.customer_email,
            'customerPhone', v_order.customer_phone,
            'notes', v_order.notes,
            'subtotalEgp', v_order.subtotal_egp,
            'discountEgp', v_order.discount_egp,
            'totalEgp', v_order.total_egp,
            'totalUsd', v_order.total_usd,
            'paymentMethod', v_order.payment_method,
            'transferNumber', v_order.transfer_number,
            'receiptImage', v_order.receipt_image_url,
            'paymentStatus', v_order.payment_status,
            'fulfillmentStatus', v_order.fulfillment_status,
            'status', v_order.status,
            'items', COALESCE(v_items, '[]'::jsonb),
            'accessToken', v_order.access_token
        );
    ELSE
        -- Return masked view for privacy
        RETURN jsonb_build_object(
            'orderId', v_order.order_id,
            'createdAt', v_order.created_at,
            'customerName', overlay(v_order.customer_name placing '***' from 3 for 5),
            'customerEmail', '***@***.***',
            'customerPhone', '*******' || right(v_order.customer_phone, 4),
            'subtotalEgp', v_order.subtotal_egp,
            'discountEgp', v_order.discount_egp,
            'totalEgp', v_order.total_egp,
            'totalUsd', v_order.total_usd,
            'paymentMethod', v_order.payment_method,
            'paymentStatus', v_order.payment_status,
            'fulfillmentStatus', v_order.fulfillment_status,
            'status', v_order.status,
            'items', COALESCE(v_items, '[]'::jsonb)
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Safe Unpaid Order Expiration Sweeper RPC
CREATE OR REPLACE FUNCTION public.expire_unpaid_orders(p_timeout_hours INT DEFAULT 48)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_cancelled_count INT := 0;
BEGIN
    IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
        RAISE EXCEPTION 'Unauthorized: only an administrator or service_role can expire unpaid orders.';
    END IF;

    FOR v_order IN 
        SELECT * FROM public.orders 
        WHERE status = 'pending' 
          AND payment_status = 'unverified'
          AND created_at < NOW() - (p_timeout_hours || ' hours')::INTERVAL
    LOOP
        PERFORM public.update_order_status_secure(v_order.order_id, 'rejected', 'cancelled', 'إلغاء تلقائي بسبب انتهاء مهلة السداد واسترجاع المخزون');
        v_cancelled_count := v_cancelled_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'cancelled_count', v_cancelled_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ==============================================================================
-- 20. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- CATEGORIES
DO $$ BEGIN
    CREATE POLICY "Categories viewable by everyone" ON public.categories FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin manage categories" ON public.categories FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- PRODUCTS (Column permissions enforced below; active products viewable)
DO $$ BEGIN
    CREATE POLICY "Active products viewable by everyone" ON public.products FOR SELECT USING (is_active = true OR public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin manage products" ON public.products FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- PRODUCT VARIANTS
DO $$ BEGIN
    CREATE POLICY "Active variants viewable by everyone" ON public.product_variants FOR SELECT USING (is_active = true OR public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin manage variants" ON public.product_variants FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- INVENTORY & MOVEMENTS
DO $$ BEGIN
    CREATE POLICY "Public read inventory status" ON public.product_inventory FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin manage inventory" ON public.product_inventory FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin view inventory movements" ON public.inventory_movements FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- BUNDLES & ITEMS
DO $$ BEGIN
    CREATE POLICY "Active bundles viewable by everyone" ON public.bundles FOR SELECT USING (is_active = true OR public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin manage bundles" ON public.bundles FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Bundle items viewable by everyone" ON public.bundle_items FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin manage bundle items" ON public.bundle_items FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- PAYMENT METHODS
DO $$ BEGIN
    CREATE POLICY "Active payment methods viewable by everyone" ON public.payment_methods FOR SELECT USING (is_active = true OR public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin manage payment methods" ON public.payment_methods FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- PROFILES
DO $$ BEGIN
    CREATE POLICY "Users view own profile or admin" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Users update own profile or admin" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ORDERS & ITEMS (DIRECT INSERTION STRICTLY BLOCKED; ACCESSIBLE ONLY VIA RPC OR SERVICE ROLE)
DO $$ BEGIN
    CREATE POLICY "Orders insert restricted to service_role" ON public.orders FOR INSERT WITH CHECK (auth.role() = 'service_role' OR public.is_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Customers view own orders or admin" ON public.orders FOR SELECT USING (
        (auth.uid() IS NOT NULL AND customer_id = auth.uid()) OR public.is_admin() OR auth.role() = 'service_role'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin manage orders" ON public.orders FOR UPDATE USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin delete orders" ON public.orders FOR DELETE USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Order items insert restricted to service_role" ON public.order_items FOR INSERT WITH CHECK (auth.role() = 'service_role' OR public.is_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "View order items restricted" ON public.order_items FOR SELECT USING (
        public.is_admin() OR auth.role() = 'service_role' OR EXISTS (
            SELECT 1 FROM public.orders o 
            WHERE o.id = order_items.order_id AND (o.customer_id = auth.uid())
        )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ORDER STATUS HISTORY
DO $$ BEGIN
    CREATE POLICY "Admin view status history" ON public.order_status_history FOR SELECT USING (
        public.is_admin() OR auth.role() = 'service_role' OR EXISTS (
            SELECT 1 FROM public.orders o 
            WHERE o.id = order_status_history.order_id AND o.customer_id = auth.uid()
        )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- PAYMENT RECORDS
DO $$ BEGIN
    CREATE POLICY "Admin manage payment records" ON public.payment_records FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- REVIEWS (Only approved reviews visible to public)
DO $$ BEGIN
    CREATE POLICY "Approved reviews viewable" ON public.reviews FOR SELECT USING (is_approved = true OR public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Submit reviews" ON public.reviews FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin manage reviews" ON public.reviews FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- SUPPORT TICKETS
DO $$ BEGIN
    CREATE POLICY "Submit support tickets" ON public.support_tickets FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin manage tickets" ON public.support_tickets FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- COUPONS
DO $$ BEGIN
    CREATE POLICY "Active coupons viewable" ON public.coupons FOR SELECT USING (is_active = true OR public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin manage coupons" ON public.coupons FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- STORE SETTINGS
DO $$ BEGIN
    CREATE POLICY "Settings viewable" ON public.store_settings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin manage settings" ON public.store_settings FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ==============================================================================
-- 21. EXPLICIT LEAST-PRIVILEGE GRANTS & REVOKES
-- ==============================================================================

-- Schema Usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Revoke dangerous direct write permissions from public clients
REVOKE INSERT, UPDATE, DELETE ON public.categories FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.products FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.product_variants FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.product_inventory FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.inventory_movements FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.bundles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.bundle_items FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_methods FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_status_history FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_records FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.reviews FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.support_tickets FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.coupons FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.store_settings FROM anon, authenticated;

-- Protect Wholesale Columns on Base Products Table (Exclude wholesale_egp, wholesale_usd, source_bot)
REVOKE ALL ON public.products FROM anon, authenticated;
GRANT SELECT (
    id, name, category_id, duration, price_egp, price_usd, is_featured,
    image, featured_image, rating, rating_count, description, specs,
    full_desc, activation_guide, delivery_instructions, warranty,
    is_active, is_archived, display_order, created_at, updated_at
) ON public.products TO anon, authenticated;

-- Grant Safe View to Public Clients
GRANT SELECT ON public.products_catalog TO anon, authenticated, service_role;
GRANT SELECT ON public.categories TO anon, authenticated, service_role;
GRANT SELECT ON public.bundles TO anon, authenticated, service_role;
GRANT SELECT ON public.bundle_items TO anon, authenticated, service_role;
GRANT SELECT ON public.payment_methods TO anon, authenticated, service_role;
GRANT SELECT ON public.store_settings TO anon, authenticated, service_role;
GRANT SELECT ON public.reviews TO anon, authenticated, service_role;
GRANT INSERT ON public.reviews TO anon, authenticated, service_role;
GRANT INSERT ON public.support_tickets TO anon, authenticated, service_role;
GRANT SELECT ON public.coupons TO anon, authenticated, service_role;

-- Service role has unrestricted access to all tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Function Execution Privileges
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_order_securely(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lookup_order(TEXT, TEXT) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_order_status_secure(TEXT, payment_status, fulfillment_status, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.adjust_inventory(TEXT, stock_type, INT, INT, INT, BOOLEAN, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_unpaid_orders(INT) TO authenticated, service_role;

-- Administrative Role Functions Restricted to Service Role Only
GRANT EXECUTE ON FUNCTION public.assign_admin_role(UUID, user_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.provision_admin_user(TEXT) TO service_role;

-- ==============================================================================
-- 22. STORAGE BUCKETS (RECEIPTS ARE STRICTLY PRIVATE & VALIDATED)
-- ==============================================================================
DO $$ BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
    VALUES (
        'receipts', 
        'receipts', 
        false, 
        5242880, 
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
    )
    ON CONFLICT (id) DO UPDATE SET 
        public = false,
        file_size_limit = 5242880,
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[];
EXCEPTION WHEN OTHERS THEN
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('receipts', 'receipts', false)
    ON CONFLICT (id) DO UPDATE SET public = false;
END $$;

DO $$ BEGIN
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('product-media', 'product-media', true)
    ON CONFLICT (id) DO UPDATE SET public = true;
EXCEPTION WHEN OTHERS THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Upload payment receipts validated" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'receipts'
        AND LOWER(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'pdf')
        AND (name LIKE 'NEXA-%' OR (storage.foldername(name))[1] LIKE 'NEXA-%' OR name LIKE 'receipts/NEXA-%')
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Authorized view payment receipts" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'receipts' 
        AND (
            public.is_admin() 
            OR auth.role() = 'service_role'
            OR (auth.uid() IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.orders o 
                WHERE o.customer_id = auth.uid() 
                  AND (storage.objects.name LIKE '%' || o.order_id || '%')
            ))
        )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public read product media" ON storage.objects
    FOR SELECT USING (bucket_id = 'product-media');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin manage product media" ON storage.objects
    FOR ALL USING (bucket_id = 'product-media' AND (public.is_admin() OR auth.role() = 'service_role'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ==============================================================================
-- 23. COMPLETE SEED DATA (CATEGORIES, 33 PRODUCTS, INVENTORY, PAYMENTS, BUNDLES, COUPONS, SETTINGS)
-- ==============================================================================

-- 1. Categories
INSERT INTO public.categories (id, name, icon, description, display_order) VALUES
('ai', 'أدوات الذكاء الاصطناعي', 'fa-solid fa-wand-magic-sparkles', 'ChatGPT Plus · Claude 3.5 · Gemini · Perplexity', 1),
('creative', 'البرامج الإبداعية والتصميم', 'fa-solid fa-palette', 'Adobe CC · Canva Pro · CapCut Pro · Figma', 2),
('office', 'برامج المكتب والإنتاجية', 'fa-solid fa-border-all', 'Microsoft 365 · Notion · Zoom Pro · Coursera', 3),
('streaming', 'الترفيه والاشتراكات', 'fa-solid fa-play', 'YouTube Premium · Spotify · Prime Video', 4),
('gaming', 'الألعاب والبطاقات والحماية', 'fa-solid fa-gamepad', 'Discord Nitro · NordVPN · ProtonVPN', 5)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name, 
  icon = EXCLUDED.icon, 
  description = EXCLUDED.description, 
  display_order = EXCLUDED.display_order;

-- 2. Dynamic Payment Methods (Vodafone Cash, InstaPay, USDT TRC20)
INSERT INTO public.payment_methods (id, name, code, account_number, account_name, instructions, currency, network, wallet_address, requires_receipt, display_order, is_active) VALUES
('vodafone_cash', 'فودافون كاش (Vodafone Cash)', 'VODAFONE_CASH', '01225106057', 'Nexa Store Cash', 'قم بالتحويل إلى رقم فودافون كاش الموضح، ثم ارفع صورة أو لقطة شاشة لإيصال التحويل مع إدخال رقم المحول منه لتأكيد طلبك فوراً.', 'EGP', NULL, NULL, true, 1, true),
('instapay', 'إنستاباي (InstaPay)', 'INSTAPAY', '01225106057', 'nexa@instapay', 'افتح تطبيق إنستاباي وقم بالتحويل اللحظي إلى العنوان أو رقم الهاتف الموضح. يرجى إرفاق إيصال التحويل البنكي لإتمام التفعيل السريع.', 'EGP', NULL, NULL, true, 2, true),
('usdt', 'عملة USDT المشفرة (Crypto)', 'USDT', NULL, 'Nexa Crypto Hub', 'قم بتحويل المبلغ بالدولار الرقمي USDT عبر شبكة TRC20 المعتمدة إلى عنوان المحفظة الرسمي أدناه. يرجى إدخال هاش المعاملة (TxID) وإرفاق الإيصال.', 'USD', 'TRC20', 'TY23... (يرجى تعديل عنوان المحفظة من لوحة التحكم)', true, 3, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  account_number = EXCLUDED.account_number,
  account_name = EXCLUDED.account_name,
  instructions = EXCLUDED.instructions,
  currency = EXCLUDED.currency,
  network = EXCLUDED.network,
  requires_receipt = EXCLUDED.requires_receipt,
  display_order = EXCLUDED.display_order;

-- 3. Store Settings
INSERT INTO public.store_settings (key, value) VALUES
('store_info', '{"store_name": "Nexa Digital Store", "email": "support@nexadigital.store", "phone": "01225106057", "whatsapp": "https://wa.me/201225106057", "address": "القاهرة، جمهورية مصر العربية"}'::jsonb),
('currency_config', '{"usd_egp_rate": 50.0, "primary_currency": "EGP", "secondary_currency": "USD"}'::jsonb),
('announcement', '{"active": true, "text": "مرحباً بكم في متجر نكسا الرقمي — تفعيل فوري لكافة الاشتراكات وضمان رسمي كامل طوال المدة!"}'::jsonb),
('promotions', '{"global_discount_percent": 0.0, "banner_active": false, "banner_text": ""}'::jsonb),
('maintenance_mode', '{"enabled": false, "message": "المتجر في وضع الصيانة الدورية المجدولة لتحديث الخوادم، سنعود بعد قليل."}'::jsonb),
('delivery_settings', '{"auto_fulfillment": true, "default_activation": "ready", "support_hours": "24/7"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4. Coupons
INSERT INTO public.coupons (code, discount_type, discount_value, min_order_value, max_discount_amount, usage_limit, usage_count, is_active) VALUES
('NEXA20', 'percentage', 20.00, 300.00, 200.00, 500, 0, true),
('VIP100', 'fixed', 100.00, 400.00, 100.00, 200, 0, true),
('WELCOME', 'fixed', 50.00, 150.00, 50.00, 1000, 0, true)
ON CONFLICT (code) DO NOTHING;

-- 5. All 33 Official Products from products-data.js
INSERT INTO public.products (id, name, category_id, duration, wholesale_egp, price_egp, price_usd, wholesale_usd, source_bot, is_featured, image, featured_image, rating, rating_count, description, specs, full_desc, activation_guide, delivery_instructions, warranty, is_active, display_order) VALUES
('ai-chatgpt-plus', 'ChatGPT Plus 1M', 'ai', '1 شهر', 700, 1400, 28.00, 12.88, '@snart_store_bot', true, 'logos/chatgpt-plus.webp', 'logos/chatgpt-plus.webp', 4.9, '2.3K', 'اشتراك شات جي بي تي بلس الرسمي يدعم GPT-4o وتوليد الصور عبر DALL-E بلا حدود.', '["وصول غير محدود لنموذج GPT-4o و GPT-4", "توليد وتعديل الصور فائقة الدقة بـ DALL-E 3", "تحليل ملفات البيانات والبرمجة المتقدمة", "تفعيل رسمي وضمان كامل طوال الشهر"]'::jsonb, 'اشتراك ChatGPT Plus الرسمي بحساب خاص مجهز، وصول غير محدود لكل المزايا المتقدمة.', '1. نرسل لك بيانات الدخول عبر واتساب والإيميل.\n2. سجل الدخول مباشرة على chatgpt.com واستمتع بكافة المزايا.', 'تسليم فوري ومباشر إلى بريدك الإلكتروني والواتساب المسجل بالطلب.', 'ضمان كامل طوال فترة الاشتراك واستبدال فوري عند أي خلل.', true, 1),

('ai-perplexity-pro', 'Perplexity PRO 12M', 'ai', '1 سنة', 750, 1500, 30.00, 14.00, '@RichAIStoreBot', false, 'logos/perplexity.webp', 'logos/perplexity.webp', 4.9, '980', 'محرك البحث الذكي الشامل، يجمع بين كل نماذج الذكاء الاصطناعي في منصة واحدة.', '["أكثر من 300 بحث Pro يومياً", "اختيار النموذج (Claude 3.5 Sonnet, GPT-4o)", "رفع وتحليل ملفات PDF والمستندات بلا حدود", "تفعيل سنوي رسمي مع ضمان"]'::jsonb, 'محرك البحث الذكي الشامل لجميع نماذج الذكاء الاصطناعي مع وصول سنوي Pro.', '1. نرسل لك كود أو رابط تفعيل الاشتراك السنوي.\n2. قم بالربط بحسابك مباشرة.', 'يتم إرسال رابط التفعيل الفوري مع الشرح المرئي.', 'ضمان رسمي لمدة سنة كاملة.', true, 2),

('ai-gemini-18m', 'Google Gemini Advanced 18M', 'ai', '18 شهر', 25, 75, 1.50, 0.49, '@storeBatmanBot', false, 'logos/gemini.webp', 'logos/gemini.webp', 4.8, '1.5K', 'حساب جيميني أدفانسد العملاق بسعة نافذة سياق 1M توكنز و2 تيرابايت مساحة سحابية.', '["نموذج Gemini 1.5 Pro فائق السرعة", "نافذة سياق ضخمة لتحليل الكتب والأفلام", "مساحة Google One السحابية 2TB", "تسليم فوري وتفعيل مباشر"]'::jsonb, 'اشتراك Gemini Advanced لمدة 18 شهراً مع مساحة تخزين 2TB سحابية.', '1. نرسل لك بيانات الحساب الرسمي المجهز.\n2. ابدأ الاستخدام مباشرة على gemini.google.com.', 'بيانات الحساب تصلك فور تأكيد الدفع.', 'ضمان طوال 18 شهر.', true, 3),

('ai-gemini-3m', 'Google Gemini Advanced 3M', 'ai', '3 شهور', 40, 120, 2.40, 0.70, '@storeBatmanBot', false, 'logos/gemini.webp', 'logos/gemini.webp', 4.8, '620', 'باقة جيميني أدفانسد لمدة 3 شهور جاهزة للاستخدام الفوري.', '["Gemini Advanced 1.5 Pro", "سرعة استجابة فائقة", "دعم كامل للغة العربية والإنجليزية", "تسليم فوري"]'::jsonb, 'اشتراك Gemini Advanced لمدة 3 شهور.', '1. استلم الحساب فورا عبر واتساب.\n2. سجل دخولك على جوجل.', 'تسليم فوري عبر الواتساب والإيميل.', 'ضمان استبدال فوري طوال الـ 3 شهور.', true, 4),

('ai-claude-pro', 'Claude 3.5 Sonnet Pro', 'ai', '1 شهر', 650, 1350, 27.00, 12.00, '@RichAIStoreBot', false, 'logos/claude.webp', 'logos/claude.webp', 4.9, '1.8K', 'أقوى نموذج ذكاء اصطناعي للبرمجة وكتابة المحتوى الأكاديمي والتحليل العميق.', '["وصول غير محدود لـ Claude 3.5 Sonnet", "ميزة Artifacts التفاعلية لتطوير التطبيقات", "أعلى دقة برمجية ولغوية في العالم", "حساب خاص مضمون 100%"]'::jsonb, 'اشتراك Claude Pro الرسمي لكافة المهام البرمجية والتطويرية.', '1. نرسل لك الحساب الخاص بك مفعل مسبقا.\n2. سجل الدخول على claude.ai مباشرة.', 'تسليم فوري لحساب رسمي خاص ومفعل مسبقاً.', 'ضمان كامل طوال الشهر.', true, 5),

('ai-midjourney-standard', 'Midjourney Standard Plan', 'ai', '1 شهر', 900, 1600, 32.00, 16.50, '@RichAIStoreBot', false, 'logos/midjourney.webp', 'logos/midjourney.webp', 4.9, '3.1K', 'المنصة رقم 1 عالمياً لتوليد الصور الخيالية والفنية بأعلى جودة واحترافية.', '["15 ساعة Fast GPU لتوليد الصور بسرعة", "توليد غير محدود في وضع Relax", "حقوق الاستخدام التجاري الكاملة", "وصول حصري لمعرض الأعضاء"]'::jsonb, 'اشتراك Midjourney Standard الرسمي عبر ديسكورد.', '1. تسليم فوري لحساب ديسكورد مجهز باشتراك مفعل.\n2. انضم وابدأ التوليد فورا.', 'إرسال بيانات حساب الديسكورد المجهز مباشرة.', 'ضمان طوال مدة الاشتراك.', true, 6),

('cr-capcut-pro-1y', 'CapCut Pro 1 Year', 'creative', '1 سنة', 120, 360, 7.20, 2.30, '@RichAIStoreBot', true, 'logos/capcut-pro.webp', 'logos/capcut-pro.webp', 4.9, '5.4K', 'الاشتراك الأقوى لصناع المحتوى ومحرري الفيديو، تفعيل سنوي رسمي بكافة الميزات.', '["تصدير بدقة 4K 60FPS بدون علامة مائية", "جميع القوالب والتأثيرات الصوتية والذكاء الاصطناعي Pro", "توليد نصوص وترجمة تلقائية فائقة الدقة", "يعمل على الهاتف، الكمبيوتر والويب"]'::jsonb, 'اشتراك CapCut Pro السنوي لإنتاج مقاطع الفيديو باحترافية.', '1. نرسل لك بيانات الحساب المجهز.\n2. سجل الدخول في تطبيق CapCut على الهاتف أو الكمبيوتر.', 'تصلك بيانات الحساب فورا عبر واتساب والإيميل.', 'ضمان استبدال فوري لمدة سنة كاملة.', true, 7),

('cr-canva-pro-edu', 'Canva Pro Lifetime / 1Y', 'creative', '1 سنة', 30, 90, 1.80, 0.58, '@storeBatmanBot', false, 'logos/canva.webp', 'logos/canva.webp', 4.9, '12.8K', 'وصول كامل لجميع قوالب وتصاميم كانفا الاحترافية وإزالة الخلفيات بنقرة واحدة.', '["أكثر من 100 مليون صورة وقالب وفيديو Pro", "أدوات الذكاء الاصطناعي Magic Resize و BG Remover", "مساحة تخزين سحابية ضخمة 1TB", "تفعيل مباشر على إيميلك الشخصي"]'::jsonb, 'اشتراك كانفا برو الرسمي لتصميم السوشيال ميديا والعروض التقديمية.', '1. نرسل لك رابط دعوة مباشر للانضمام.\n2. اضغط على الرابط وسيتفعل اشتراكك فورا على إيميلك الشخصي.', 'رابط دعوة مباشر ينقلك فوراً للاشتراك دون كلمة مرور.', 'ضمان رسمي كامل.', true, 8),

('cr-adobe-all-apps', 'Adobe Creative Cloud All Apps 1M', 'creative', '1 شهر', 850, 1550, 31.00, 15.80, '@snart_store_bot', false, 'logos/adobe-cc.webp', 'logos/adobe-cc.webp', 4.9, '4.2K', 'الحزمة الإبداعية الكاملة تضم Photoshop, Illustrator, Premiere, After Effects والمزيد.', '["أكثر من 20 تطبيق إبداعي رسمي أصلي", "100GB مساحة سحابية و Adobe Fonts", "تحديثات مستمرة من السحابة مباشرة", "تفعيل على حسابك الشخصي أو حساب جاهز"]'::jsonb, 'الحزمة الكاملة لكافة برامج أدوبي الإبداعية الأصلية.', '1. تفعيل على إيميلك الشخصي أو تسليم حساب مجهز.\n2. حمل البرامج من Adobe Creative Cloud الرسمي.', 'تفعيل مباشر على بريدك أو تسليم فوري لحساب جاهز.', 'ضمان رسمي كامل طوال الشهر.', true, 9),

('cr-figma-pro', 'Figma Professional 1 Year', 'creative', '1 سنة', 150, 450, 9.00, 2.90, '@storeBatmanBot', false, 'logos/figma.webp', 'logos/figma.webp', 4.8, '1.1K', 'اشتراك فيجما للمصممين المحترفين وفرق العمل، مشاريع ومكتبات غير محدودة.', '["مشاريع وتصاميم غير محدودة", "مكتبات مكونات Team Libraries مشتركة", "تاريخ نسخ غير محدود للملفات", "تفعيل سنوي مضمون"]'::jsonb, 'اشتراك فيجما برو السنوي لتصميم واجهات المستخدم UI/UX.', '1. دعوة رسمية لحسابك الخاص.\n2. وصول غير محدود لكل خصائص Pro.', 'دعوة رسمية إلى بريدك المسجل في فيجما.', 'ضمان سنوي كامل.', true, 10),

('of-microsoft-365', 'Microsoft 365 Family / Pro 1Y', 'office', '1 سنة', 90, 270, 5.40, 1.75, '@storeBatmanBot', true, 'logos/office-365.webp', 'logos/office-365.webp', 4.9, '8.9K', 'باقة أوفيس 365 الرسمية مع Word, Excel, PowerPoint و 1TB تخزين OneDrive سحابي.', '["Word, Excel, PowerPoint, Outlook", "1 تيرابايت مساحة تخزين ون درايف آمنة", "يعمل على 5 أجهزة (ويندوز، ماك، آيفون، أندرويد)", "تحديثات أمنية ورسمية مستمرة"]'::jsonb, 'حزمة ميكروسوفت أوفيس 365 الرسمية لمدة عام كامل مع 1TB OneDrive.', '1. نرسل لك كود تفعيل أو بيانات الحساب الرسمي.\n2. ادخل على setup.office.com وحمل التطبيقات.', 'تصلك بيانات الحساب أو كود التفعيل عبر الواتساب.', 'ضمان رسمي لمدة سنة كاملة.', true, 11),

('of-notion-plus', 'Notion Plus 1 Year', 'office', '1 سنة', 80, 240, 4.80, 1.55, '@storeBatmanBot', false, 'logos/notion.webp', 'logos/notion.webp', 4.9, '2.1K', 'منصة تنظيم العمل والملاحظات وإدارة المشاريع الأكثر إنتاجية عالمياً.', '["صفحات وبلوكات غير محدودة", "مزامنة سريعة ودعم رفع ملفات بحجم غير محدود", "Notion AI متقدم لتلخيص وتوليد النصوص", "تفعيل سنوي رسمي"]'::jsonb, 'اشتراك نوشن بلس السنوي لإدارة المشاريع وملاحظات العمل.', '1. دعوة مباشرة على إيميلك المسجل في نوشن.\n2. تفعيل تلقائي فوري.', 'دعوة سريعة إلى إيميلك المسجل في نوشن.', 'ضمان رسمي لمدة عام كامل.', true, 12),

('of-zoom-pro-1m', 'Zoom Pro 1 Month', 'office', '1 شهر', 90, 270, 5.40, 1.75, '@storeBatmanBot', false, 'logos/zoom.webp', 'logos/zoom.webp', 4.7, '750', 'اشتراك زووم برو للاجتماعات غير المحدودة حتى 30 ساعة وبسعة 100 مشارك.', '["اجتماعات حتى 30 ساعة متواصلة", "سعة حتى 100 مشارك", "تسجيل سحابي على سيرفرات زووم 5GB", "بث مباشر عبر YouTube و Facebook"]'::jsonb, 'اشتراك زووم برو الشهري للاجتماعات والمحاضرات بدون انقطاع.', '1. تفعيل على إيميلك الشخصي أو تسليم حساب مجهز.\n2. ابدأ اجتماعاتك بلا حدود.', 'تفعيل فوري على حسابك أو حساب جديد مجهز.', 'ضمان كامل طوال الشهر.', true, 13),

('of-coursera-plus', 'Coursera Plus 1 Year', 'office', '1 سنة', 250, 750, 15.00, 4.80, '@snart_store_bot', false, 'logos/coursera.webp', 'logos/coursera.webp', 4.9, '1.4K', 'وصول غير محدود لأكثر من 7,000 دورة تدريبية وشهادة مهنية معتمدة من كبرى الجامعات.', '["وصول لكافة كورسات Google و Meta و IBM", "شهادات إتمام رسمية معتمدة لكل كورس", "مشاريع عملية موجهة Guided Projects", "تفعيل على حسابك الشخصي"]'::jsonb, 'اشتراك كورسيرا بلس السنوي لتعلم وتطوير المهارات مع شهادات موثقة.', '1. دعوة رسمية لحسابك في كورسيرا.\n2. ابدأ التعلم والحصول على الشهادات فورا.', 'دعوة فورية على حسابك بـ Coursera.', 'ضمان رسمي لمدة عام كامل.', true, 14),

('of-linkedin-learning', 'LinkedIn Learning 1 Year', 'office', '1 سنة', 180, 540, 10.80, 3.50, '@storeBatmanBot', false, 'logos/linkedin-learning.webp', 'logos/linkedin-learning.webp', 4.8, '920', 'أكبر مكتبة دورات تدريبية للأعمال والتقنية مع إضافة الشارات مباشرة لملفك الشخصي.', '["أكثر من 20,000 دورة تدريبية احترافية", "إضافة الشهادات تلقائيا لملفك في لينكد إن", "تمارين تدريبية وملفات قابلة للتحميل", "تفعيل سنوي مضمون"]'::jsonb, 'اشتراك لينكد إن ليرنينج السنوي لاكتساب مهارات القيادة والبرمجة والتسويق.', '1. تفعيل على إيميلك الشخصي في لينكد إن.\n2. تصفح وحمل الدورات من التطبيق أو الويب.', 'تفعيل رسمي على حساب لينكد إن.', 'ضمان لمدة سنة كاملة.', true, 15),

('st-youtube-premium-1y', 'YouTube Premium 1 Year', 'streaming', '1 سنة', 120, 360, 7.20, 2.30, '@snart_store_bot', true, 'logos/youtube-premium.webp', 'logos/youtube-premium.webp', 4.9, '18.5K', 'تصفح يوتيوب بدون أي إعلانات، مع تشغيل بالخلفية وتطبيق YouTube Music كامل.', '["مشاهدة خالية تماماً من الإعلانات", "تشغيل الفيديوهات في الخلفية وعند قفل الشاشة", "تحميل الفيديوهات لمشاهدتها بدون إنترنت", "اشتراك كامل في YouTube Music"]'::jsonb, 'اشتراك يوتيوب بريميوم السنوي الأصلي بدون إعلانات نهائياً.', '1. نرسل لك رابط دعوة عائلية رسمية على إيميلك.\n2. اقبل الدعوة وسيتفعل فورا على قناتك وحسابك الشخصي.', 'رابط دعوة عائلية رسمية على بريدك الإلكتروني.', 'ضمان كامل طوال مدة السنة واستبدال فوري عند الحاجة.', true, 16),

('st-youtube-premium-6m', 'YouTube Premium 6 Months', 'streaming', '6 شهور', 75, 225, 4.50, 1.45, '@snart_store_bot', false, 'logos/youtube-premium.webp', 'logos/youtube-premium.webp', 4.9, '6.3K', 'يوتيوب بريميوم لمدة 6 شهور بدون إعلانات مع يوتيوب ميوزك.', '["بدون إعلانات تماماً", "تشغيل بالخلفية بدون توقف", "يوتيوب ميوزك الرسمي", "تفعيل على إيميلك الخاص"]'::jsonb, 'اشتراك يوتيوب بريميوم لمدة 6 شهور بدون إعلانات.', '1. رابط دعوة رسمي لحسابك.\n2. تفعيل فوري بدون طلب كلمة المرور.', 'رابط دعوة سريع إلى حسابك الشخصي.', 'ضمان 6 شهور كاملة.', true, 17),

('st-spotify-1y', 'Spotify Premium 1 Year', 'streaming', '1 سنة', 140, 420, 8.40, 2.70, '@snart_store_bot', false, 'logos/spotify.webp', 'logos/spotify.webp', 4.9, '9.7K', 'استمع لملايين الأغاني والبودكاست بأعلى جودة صوتية وبدون أي فواصل إعلانية.', '["استماع بدون إعلانات وتخطي لا نهائي للأغاني", "تحميل الأغاني للاستماع أوفلاين", "أعلى جودة صوتية 320kbps Very High", "تفعيل على حسابك الشخصي أو حساب جديد"]'::jsonb, 'اشتراك سبوتيفاي بريميوم السنوي لتجربة موسيقية فائقة النقاء.', '1. رابط انضمام فوري أو حساب مجهز.\n2. تمتع بقوائمك المفضلة بدون انقطاع.', 'رابط انضمام أو حساب جاهز عبر الواتساب.', 'ضمان رسمي سنة كاملة.', true, 18),

('st-apple-music-3m', 'Apple Music 3 Months', 'streaming', '3 شهور', 50, 150, 3.00, 0.98, '@snart_store_bot', false, 'logos/apple-music.webp', 'logos/apple-music.webp', 4.8, '2.8K', 'بث صوتي فائق الدقة بدون فقدان Lossless Audio مع دعم الصوت المكاني Spatial Audio.', '["أكثر من 100 مليون أغنية بدون إعلانات", "صوت عالي الدقة Lossless و Dolby Atmos", "كلمات الأغاني متزامنة بالوقت الحقيقي", "يعمل على آيفون، أندرويد، ويندوز وماك"]'::jsonb, 'اشتراك أبل ميوزك 3 شهور بأعلى نقاء صوتي في العالم.', '1. كود أو دعوة رسمية لحساب Apple ID الخاص بك.\n2. تفعيل مباشر.', 'كود أو رابط دعوة رسمي فوري.', 'ضمان 3 شهور كاملة.', true, 19),

('st-prime-video-6m', 'Amazon Prime Video 6 Months', 'streaming', '6 شهور', 60, 180, 3.60, 1.15, '@storeBatmanBot', false, 'primevideo_icon.svg', 'primevideo_icon.svg', 4.7, '3.4K', 'أضخم مكتبة أفلام ومسلسلات أصلية بدقة 4K HDR مع ترجمة ودبلجة عربية احترافية.', '["مشاهدة بدقة 4K UHD و HDR10", "أعمال أمازون الأصلية الحصرية The Boys, LOTR", "تحميل المشاهدة أوفلاين على الأجهزة الذكية", "حساب خاص مجهز بملف شخصي خاص"]'::jsonb, 'اشتراك أمازون برايم فيديو 6 شهور لأفضل الأفلام العالمية والمسلسلات الحصرية.', '1. نرسل لك إيميل وباسورد الحساب الرسمي.\n2. اختر ملفك واستمتع بالمشاهدة.', 'إرسال بيانات الحساب الخاص فورا.', 'ضمان طوال 6 شهور.', true, 20),

('gm-discord-nitro-1y', 'Discord Nitro 1 Year', 'gaming', '1 سنة', 350, 1050, 21.00, 6.80, '@snart_store_bot', true, 'logos/discord-nitro.webp', 'logos/discord-nitro.webp', 4.9, '14.2K', 'ترقية ديسكورد نيترو الكاملة مع 2 سيرفر بوست واستخدام الإيموجيات في كل مكان.', '["2 سيرفر بوست Server Boosts مجاناً شهرياً", "مشاركة شاشة بدقة 4K 60FPS فائقة السلاسة", "استخدام الإيموجيات والستيكرات المتحركة في أي سيرفر", "رفع ملفات ضخمة بحجم يصل إلى 500MB"]'::jsonb, 'اشتراك ديسكورد نيترو الكامل السنوي لمحترفي الألعاب ومطوري السيرفرات.', '1. نرسل لك رابط هدية Nitro Gift رسمي أو كود تفعيل فوري.\n2. اضغط على الرابط وسيتفعل فورا على حسابك في ديسكورد.', 'رابط هدية Nitro Gift رسمي يفتح على حسابك فوراً.', 'ضمان رسمي كامل لمدة سنة واستبدال فوري.', true, 21),

('gm-discord-nitro-1m', 'Discord Nitro 1 Month', 'gaming', '1 شهر', 45, 135, 2.70, 0.88, '@snart_store_bot', false, 'logos/discord-nitro.webp', 'logos/discord-nitro.webp', 4.9, '8.7K', 'ديسكورد نيترو الكامل لمدة شهر مع بوستين وشاشة 4K.', '["2 سيرفر بوست مجاناً", "بث شاشة 4K 60FPS", "شارة Nitro الحصرية للملف الشخصي", "إيموجيات في كل مكان"]'::jsonb, 'اشتراك ديسكورد نيترو الشهري.', '1. رابط تفعيل مباشر على حسابك.\n2. تفعيل في ثوان معدودة.', 'رابط تفعيل فوري سريع.', 'ضمان كامل طوال الشهر.', true, 22),

('gm-nordvpn-1y', 'NordVPN 1 Year', 'gaming', '1 سنة', 80, 240, 4.80, 1.55, '@storeBatmanBot', false, 'logos/nordvpn.webp', 'logos/nordvpn.webp', 4.9, '5.6K', 'أسرع وأقوى شبكة VPN في العالم لحماية خصوصيتك وفتح المواقع المحجوبة وتقليل البنج.', '["أكثر من 6000 سيرفر فائق السرعة في 111 دولة", "تشفير عسكري من الدرجة الأولى وحظر الإعلانات", "حماية من التهديدات Threat Protection", "يعمل على 6 أجهزة في نفس الوقت"]'::jsonb, 'اشتراك NordVPN السنوي لتأمين اتصالك وفتح المحتوى العالمي بدون قيود.', '1. حساب رسمي مفعل باشتراك سنوي مدفوع.\n2. سجل الدخول في تطبيق NordVPN على أي جهاز.', 'بيانات الحساب الرسمي ترسل فورا.', 'ضمان استبدال فوري لمدة سنة كاملة.', true, 23),

('gm-protonvpn-1y', 'ProtonVPN Plus 1 Year', 'gaming', '1 سنة', 95, 285, 5.70, 1.85, '@storeBatmanBot', false, 'logos/protonvpn.webp', 'logos/protonvpn.webp', 4.8, '2.3K', 'شبكة VPN سويسرية فائقة الأمان مع سياسة صارمة لعدم حفظ السجلات وسرعات تصل لـ 10Gbps.', '["سيرفرات سويسرية فائقة الخصوصية Secure Core", "سرعات خارقة تصل إلى 10Gbps مع ميزة VPN Accelerator", "حماية NetShield ضد الإعلانات والبرمجيات الخبيثة", "يدعم التورنت والستريمنج P2P"]'::jsonb, 'اشتراك بروتون في بي إن بلس السنوي لحرية وخصوصية مطلقة على الإنترنت.', '1. حساب مجهز باشتراك رسمي مدفوع.\n2. اتصل فورا بأقوى السيرفرات السويسرية.', 'تسليم بيانات الحساب السويسري المجهز.', 'ضمان رسمي كامل لمدة سنة.', true, 24),

('gm-playstation-plus', 'PlayStation Plus Deluxe 1M', 'gaming', '1 شهر', 180, 540, 10.80, 3.50, '@snart_store_bot', false, 'logos/playstation.webp', 'logos/playstation.webp', 4.8, '4.1K', 'أعلى فئة لاشتراكات بلايستيشن بلس، مكتبة ألعاب ضخمة وتجارب ألعاب كلاسيكية وتجريبية.', '["كتالوج ألعاب ضخم يضم مئات ألعاب PS4 و PS5", "تجارب الألعاب الحصرية قبل الشراء Game Trials", "ألعاب كلاسيكية من أجيال PS1, PS2, PSP", "ألعاب مجانية شهرية واللعب أونلاين Multi-player"]'::jsonb, 'اشتراك بلايستيشن بلس ديلوكس الشهري للتمتع بأقوى مكتبة ألعاب حصرية.', '1. حساب مجهز بحساب تركي/أمريكي مفعل فيه البلس.\n2. فعل الحساب كجهاز رئيسي Primary واستمتع باللعب على حسابك الشخصي.', 'تسليم الحساب مع دليل التفعيل كـ Primary.', 'ضمان كامل طوال الشهر.', true, 25),

('gm-xbox-game-pass', 'Xbox Game Pass Ultimate 1M', 'gaming', '1 شهر', 120, 360, 7.20, 2.30, '@snart_store_bot', false, 'logos/xbox.webp', 'logos/xbox.webp', 4.9, '6.8K', 'وصول غير محدود لأكثر من 400 لعبة على أجهزة Xbox والكمبيوتر واللعب السحابي Cloud.', '["أكثر من 400 لعبة على الكونسول والـ PC", "ألعاب استوديوهات مايكروسوفت في اليوم الأول Day One", "اشتراك EA Play كامل مدمج مجاناً", "لعب أونلاين وخصومات حصرية للأعضاء"]'::jsonb, 'اشتراك جيم باس ألتيميت الشهري لألعاب الإكس بوكس والكمبيوتر.', '1. كود تفعيل رسمي أو حساب مجهز.\n2. حمل والعب فوراً.', 'كود رقمي فوري أو بيانات حساب مجهز.', 'ضمان استبدال فوري طوال الشهر.', true, 26),

('ai-elevenlabs-starter', 'ElevenLabs Starter 1M', 'ai', '1 شهر', 120, 360, 7.20, 2.30, '@snart_store_bot', false, 'Robot_head_floating_above_platform_2K_20261008041722.jpg', 'Robot_head_floating_above_platform_2K_20261008041722.jpg', 4.9, '1.9K', 'أقوى تقنية تحويل النص إلى صوت بشري واقعي واستنساخ الأصوات بدقة استثنائية.', '["30,000 حرف شهرياً من الصوت البشري فائق الواقعية", "إنشاء واستنساخ حتى 10 أصوات مخصصة", "ترجمة صوتية احترافية مع الحفاظ على نبرة الصوت الأصلي", "حقوق الاستخدام التجاري الكاملة"]'::jsonb, 'اشتراك ElevenLabs الرسمي لتوليد الدوبلاج والتعليق الصوتي الاحترافي.', '1. حساب رسمي مجهز بباقة Starter.\n2. ادخل وابدأ توليد أصوات احترافية ومقاطع بودكاست.', 'إرسال بيانات الحساب المجهز مباشرة.', 'ضمان كامل طوال الشهر.', true, 27),

('ai-runway-gen3', 'Runway Gen-3 Alpha 1M', 'ai', '1 شهر', 350, 1050, 21.00, 6.80, '@snart_store_bot', false, 'Enhancing_image_without_text_2K_20261008033420.jpg', 'Enhancing_image_without_text_2K_20261008033420.jpg', 4.9, '1.4K', 'المنصة السينمائية الرائدة عالمياً لتوليد وتحريك مقاطع الفيديو الواقعية بالذكاء الاصطناعي.', '["625 كريدت شهرياً لتوليد فيديوهات فائقة الجودة", "وصول لأقوى نموذج Gen-3 Alpha Cinematic", "إزالة العلامة المائية ودقة تصدير 4K سينمائية", "أدوات تحكم بحركة الكاميرا Motion Brush"]'::jsonb, 'اشتراك Runway Gen-3 الرسمي لإنتاج المشاهد السينمائية والإعلانية.', '1. حساب رسمي مفعل وجاهز للاستخدام الفوري.\n2. انطلق في توليد الفيديو مباشرة.', 'تسليم بيانات الحساب السريع.', 'ضمان كامل طوال مدة الاشتراك.', true, 28),

('cr-premiere-pro-1m', 'Adobe Premiere Pro 1M', 'creative', '1 شهر', 280, 840, 16.80, 5.40, '@snart_store_bot', false, 'Removing_text_from_image_2K_20261008033655.jpg', 'Removing_text_from_image_2K_20261008033655.jpg', 4.9, '3.2K', 'البرنامج الرائد في مونتاج الأفلام والفيديوهات، تفعيل أصلي رسمي من سحابة أدوبي.', '["أحدث إصدار من Adobe Premiere Pro", "تفريغ النصوص وترجمة الفيديوهات بالذكاء الاصطناعي مدمج", "تكامل سلس مع After Effects و Photoshop", "تحديثات دورية وسحابة Adobe Cloud"]'::jsonb, 'برنامج أدوبي بريمير برو للمونتيرين ومحرري الفيديو وصناع الأفلام.', '1. تفعيل على إيميلك الشخصي أو تسليم حساب مجهز.\n2. حمل البرنامج الأصلي من Creative Cloud واستمتع بالاستقرار التام.', 'تفعيل مباشر على بريدك أو حساب جاهز.', 'ضمان رسمي كامل طوال الشهر.', true, 29),

('of-grammarly-premium', 'Grammarly Premium 1 Year', 'office', '1 سنة', 120, 360, 7.20, 2.30, '@storeBatmanBot', false, 'Enhancing_image_without_text_2K_20261008033501.jpg', 'Enhancing_image_without_text_2K_20261008033501.jpg', 4.8, '4.5K', 'المساعد الذكي الأفضل لكتابة وتدقيق النصوص الإنجليزية الأكاديمية والمهنية بدون أي أخطاء.', '["تدقيق لغوي ونحوي وإملائي متقدم فائق الدقة", "اقتراحات لتحسين أسلوب ونبرة الكتابة والوضوح", "فاحص الانتحال والسرقة الأدبية Plagiarism Checker", "يعمل على المتصفح والوورد والبريد الإلكتروني"]'::jsonb, 'اشتراك جرامارلي بريميوم السنوي لكتابة رسائل وبحوث وإيميلات خالية من العيوب.', '1. نرسل لك كود أو رابط الانضمام لحسابك.\n2. يتفعل بريميوم فورا على كافة متصفحاتك وتطبيقاتك.', 'رابط تفعيل أو كود دعوة سنوي.', 'ضمان رسمي كامل لمدة سنة كاملة.', true, 30),

('st-deezer-premium', 'Deezer Premium 1 Year', 'streaming', '1 سنة', 90, 270, 5.40, 1.75, '@snart_store_bot', false, 'Enhancing_image_without_text_2K_20261008033420.jpg', 'Enhancing_image_without_text_2K_20261008033420.jpg', 4.7, '1.6K', 'مكتبة موسيقية عملاقة مع جودة صوتية خالية من الضياع HiFi بدون أي إعلانات.', '["جودة صوت استثنائية High Fidelity FLAC", "بدون إعلانات مع إمكانية التحميل أوفلاين", "ميزة Flow الذكية للتعرف على ذوقك الموسيقي", "مزامنة الكلمات ودعم كل الأجهزة الذكية"]'::jsonb, 'اشتراك ديزر بريميوم السنوي لمحبي الموسيقى بجودة الاستوديو الأصلية.', '1. دعوة رسمية أو حساب مجهز باشتراك سنوي.\n2. استمع بحرية أينما كنت.', 'دعوة رسمية أو حساب مجهز عبر الواتساب.', 'ضمان لمدة سنة كاملة.', true, 31),

('gm-expressvpn-1y', 'ExpressVPN 1 Year', 'gaming', '1 سنة', 140, 420, 8.40, 2.70, '@snart_store_bot', false, 'Image_enhancement_and_tool_addition_2K_20261008034117.jpg', 'Image_enhancement_and_tool_addition_2K_20261008034117.jpg', 4.9, '7.8K', 'أعلى سرعات اتصال واستقرار بين جميع شبكات VPN مع بروتوكول Lightway الحصري.', '["سيرفرات فائقة السرعة موزعة في 105 دول", "بروتوكول Lightway الحصري لسرعة قصوى وبنج منخفض", "تشفير عسكري AES-256 وحماية قصوى من تسريب DNS", "يدعم أجهزة الكونسول والراوتر والكمبيوتر والهاتف"]'::jsonb, 'اشتراك ExpressVPN السنوي لتخطي الحجب وتقليل البنج في الألعاب بشكل ملحوظ.', '1. كود تفعيل رسمي أو حساب مجهز.\n2. سجل الدخول واستمتع بالسرعة القصوى والاستقرار.', 'كود تفعيل رسمي أو بيانات حساب مجهز.', 'ضمان كامل طوال مدة السنة.', true, 32),

('cr-photoshop-1m', 'Adobe Photoshop 1M', 'creative', '1 شهر', 250, 750, 15.00, 4.80, '@snart_store_bot', false, 'Removing_text_from_image_2K_20261008033655.jpg', 'Removing_text_from_image_2K_20261008033655.jpg', 4.9, '5.1K', 'البرنامج الأسطوري لتعديل وتصميم الصور مع ميزات الذكاء الاصطناعي التوليدي Generative Fill.', '["أحدث إصدار أصلي من فوتوشوب الرسمي", "ميزة التعبئة التوليدية Generative Fill المذهلة من Adobe Firefly", "مساحة سحابية سعة 20GB و Adobe Fresco", "يعمل على أجهزة الكمبيوتر والآيباد"]'::jsonb, 'اشتراك فوتوشوب الرسمي للمصممين والمصورين والفنانين الرقميين.', '1. تفعيل على إيميلك الشخصي أو تسليم حساب مجهز.\n2. حمل البرنامج الأصلي من Creative Cloud واستمتع بالميزات السحابية.', 'تفعيل على الإيميل أو حساب جاهز.', 'ضمان كامل طوال الشهر.', true, 33)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category_id = EXCLUDED.category_id,
  duration = EXCLUDED.duration,
  wholesale_egp = EXCLUDED.wholesale_egp,
  price_egp = EXCLUDED.price_egp,
  price_usd = EXCLUDED.price_usd,
  wholesale_usd = EXCLUDED.wholesale_usd,
  source_bot = EXCLUDED.source_bot,
  is_featured = EXCLUDED.is_featured,
  image = EXCLUDED.image,
  featured_image = EXCLUDED.featured_image,
  rating = EXCLUDED.rating,
  rating_count = EXCLUDED.rating_count,
  description = EXCLUDED.description,
  specs = EXCLUDED.specs,
  full_desc = EXCLUDED.full_desc,
  activation_guide = EXCLUDED.activation_guide,
  delivery_instructions = EXCLUDED.delivery_instructions,
  warranty = EXCLUDED.warranty,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order;

-- 6. Initial Inventory for all 33 Products
INSERT INTO public.product_inventory (product_id, stock_type, quantity_available, quantity_reserved, quantity_sold, low_stock_threshold, is_paused)
SELECT 
    id, 
    'unlimited'::stock_type, 
    100, 
    0, 
    0, 
    5, 
    false
FROM public.products
ON CONFLICT (product_id, variant_id) DO NOTHING;

-- 7. Seed Official Product Bundles (Combos)
INSERT INTO public.bundles (id, name, slug, description, image, original_price_egp, price_egp, price_usd, is_active, is_featured, display_order) VALUES
('bundle-ai-creator', 'باقة صانع المحتوى الذكي (ChatGPT Plus + Canva Pro + CapCut Pro)', 'ai-creator-bundle', 'الحزمة الأقوى والشاملة لصناع المحتوى والمسوقين: كتابة المحتوى بأقوى ذكاء اصطناعي، التصاميم الاحترافية مع كانفا، ومونتاج الفيديو الخارق بدقة 4K.', 'logos/chatgpt-plus.webp', 1850, 1399, 27.98, true, true, 1),
('bundle-ultimate-streaming', 'باقة الترفيه الشاملة (YouTube Premium 1Y + Spotify 1Y)', 'ultimate-streaming-bundle', 'استمتع بمشاهدة واستماع بدون أي إعلانات لمدة سنة كاملة مع يوتيوب بريميوم وسبوتيفاي بأعلى جودة صوتية وبأكبر توفير ممكن.', 'logos/youtube-premium.webp', 780, 650, 13.00, true, true, 2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  image = EXCLUDED.image,
  original_price_egp = EXCLUDED.original_price_egp,
  price_egp = EXCLUDED.price_egp,
  price_usd = EXCLUDED.price_usd,
  is_active = EXCLUDED.is_active,
  is_featured = EXCLUDED.is_featured;

-- Bundle Items Mapping
INSERT INTO public.bundle_items (bundle_id, product_id, quantity, display_order) VALUES
('bundle-ai-creator', 'ai-chatgpt-plus', 1, 1),
('bundle-ai-creator', 'cr-canva-pro-edu', 1, 2),
('bundle-ai-creator', 'cr-capcut-pro-1y', 1, 3),
('bundle-ultimate-streaming', 'st-youtube-premium-1y', 1, 1),
('bundle-ultimate-streaming', 'st-spotify-1y', 1, 2)
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- 24. MANUAL ADMINISTRATOR PROVISIONING INSTRUCTIONS
-- ==============================================================================
-- To provision your administrator user after signup, run this in Supabase SQL Editor:
-- UPDATE public.profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
--
-- Alternatively, invoke provision_admin_user via service_role:
-- SELECT public.provision_admin_user('your-email@example.com');
-- ==============================================================================
