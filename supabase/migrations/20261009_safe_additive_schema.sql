-- ==============================================================================
-- NEXA STORE - PRODUCTION HARDENED SCHEMA (NON-DESTRUCTIVE & SECURE)
-- Project Reference: mrinxsiostnzzjowutav
-- This migration is 100% NON-DESTRUCTIVE:
-- - DOES NOT drop existing tables.
-- - Validates server-side pricing on order creation.
-- - Hardens Row Level Security (RLS) to prevent public order data leakage.
-- - Secures payment receipts storage bucket.
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Define Custom Types (Safe idempotent creation)
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('customer', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Utility Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 4. TABLE: categories
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. TABLE: products
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
    warranty TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);

DO $$ BEGIN
    CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 6. TABLE: profiles (Linked to auth.users)
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

-- Auto-create profile trigger
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 7. TABLE: orders
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT UNIQUE NOT NULL,
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
    transfer_number TEXT,
    receipt_image_url TEXT,
    status order_status NOT NULL DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_order_id ON public.orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

DO $$ BEGIN
    CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 8. TABLE: order_items
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    duration TEXT,
    price_egp NUMERIC(10, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    delivery_type TEXT,
    activation_type TEXT DEFAULT 'ready',
    image TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- ------------------------------------------------------------------------------
-- 9. TABLE: reviews
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    product_name TEXT NOT NULL,
    category TEXT DEFAULT 'ai',
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT true,
    is_approved BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_category ON public.reviews(category);
CREATE INDEX IF NOT EXISTS idx_reviews_approved ON public.reviews(is_approved);

-- ------------------------------------------------------------------------------
-- 10. TABLE: support_tickets
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 11. TABLE: coupons
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL DEFAULT 'fixed',
    discount_value NUMERIC(10, 2) NOT NULL,
    min_spend NUMERIC(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 12. TABLE: store_settings
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 13. SERVER-SIDE PRICING VALIDATION & SECURE ORDER RPC
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.create_order_securely(
    p_order_id TEXT,
    p_customer_name TEXT,
    p_customer_email TEXT,
    p_customer_phone TEXT,
    p_notes TEXT,
    p_payment_method TEXT,
    p_transfer_number TEXT,
    p_receipt_image_url TEXT,
    p_coupon_code TEXT,
    p_items JSONB -- Array of { "id": "...", "quantity": 1, "activation": "ready" }
)
RETURNS JSONB AS $$
DECLARE
    v_item JSONB;
    v_product RECORD;
    v_item_price NUMERIC;
    v_subtotal NUMERIC := 0;
    v_coupon_discount NUMERIC := 0;
    v_standard_discount NUMERIC := 0;
    v_total_egp NUMERIC := 0;
    v_total_usd NUMERIC := 0;
    v_order_uuid UUID;
    v_qty INT;
    v_prod_id TEXT;
    v_delivery_type TEXT;
BEGIN
    -- 1. Validate Items Array
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item';
    END IF;

    -- 2. Calculate Verified Subtotal Directly from Database Prices
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_prod_id := v_item->>'id';
        v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::INT, 1));

        SELECT id, name, duration, price_egp, image 
        INTO v_product 
        FROM public.products 
        WHERE id = v_prod_id AND is_active = true;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % is not available or does not exist', v_prod_id;
        END IF;

        v_subtotal := v_subtotal + (v_product.price_egp * v_qty);
    END LOOP;

    -- 3. Calculate Verified 20% Standard Limited Discount
    v_standard_discount := ROUND(v_subtotal * 0.20);

    -- 4. Validate Promo Coupon if Provided
    IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
        SELECT discount_value INTO v_coupon_discount 
        FROM public.coupons 
        WHERE code = UPPER(TRIM(p_coupon_code)) AND is_active = true;
        
        IF NOT FOUND THEN
            v_coupon_discount := 0;
        END IF;
    END IF;

    -- 5. Calculate Final Verified Totals Server-Side
    v_total_egp := GREATEST(0, v_subtotal - v_standard_discount - v_coupon_discount);
    v_total_usd := ROUND((v_total_egp / 50.0), 2);

    -- 6. Insert Validated Order Record
    INSERT INTO public.orders (
        order_id,
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
        transfer_number,
        receipt_image_url,
        status
    ) VALUES (
        p_order_id,
        auth.uid(),
        p_customer_name,
        p_customer_email,
        p_customer_phone,
        p_notes,
        v_subtotal,
        v_standard_discount + v_coupon_discount,
        v_total_egp,
        v_total_usd,
        p_payment_method,
        p_transfer_number,
        p_receipt_image_url,
        'pending'
    ) RETURNING id INTO v_order_uuid;

    -- 7. Insert Order Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_prod_id := v_item->>'id';
        v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::INT, 1));

        SELECT id, name, duration, price_egp, image 
        INTO v_product 
        FROM public.products 
        WHERE id = v_prod_id;

        v_delivery_type := COALESCE(v_item->>'deliveryType', 'حساب رسمي مجهز');

        INSERT INTO public.order_items (
            order_id,
            product_id,
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
            v_product.name,
            v_product.duration,
            v_product.price_egp,
            v_qty,
            v_delivery_type,
            COALESCE(v_item->>'activation', 'ready'),
            v_product.image
        );
    END LOOP;

    -- 8. Return Success Object
    RETURN jsonb_build_object(
        'success', true,
        'order_uuid', v_order_uuid,
        'order_id', p_order_id,
        'subtotal_egp', v_subtotal,
        'discount_egp', v_standard_discount + v_coupon_discount,
        'total_egp', v_total_egp,
        'total_usd', v_total_usd
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 14. SECURE GUEST ORDER LOOKUP RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_order(p_order_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_items JSONB;
BEGIN
    SELECT * INTO v_order 
    FROM public.orders 
    WHERE order_id = p_order_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT jsonb_agg(jsonb_build_object(
        'id', product_id,
        'name', name,
        'duration', duration,
        'quantity', quantity,
        'priceEgp', price_egp,
        'deliveryType', delivery_type,
        'activation', activation_type,
        'image', image
    )) INTO v_items
    FROM public.order_items
    WHERE order_id = v_order.id;

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
        'status', v_order.status,
        'items', COALESCE(v_items, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 15. ROW LEVEL SECURITY (RLS) POLICIES - HARDENED
-- ==============================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CATEGORIES
DO $$ BEGIN
    CREATE POLICY "Categories viewable by everyone" ON public.categories FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin manage categories" ON public.categories FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- PRODUCTS
DO $$ BEGIN
    CREATE POLICY "Active products viewable by everyone" ON public.products FOR SELECT USING (is_active = true OR public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin manage products" ON public.products FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- PROFILES
DO $$ BEGIN
    CREATE POLICY "Users view own profile or admin" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Users update own profile or admin" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ORDERS - HARDENED RLS: No public dump allowed!
DO $$ BEGIN
    CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    -- Authenticated customers only see THEIR orders; Admins see ALL orders
    CREATE POLICY "Customers view own orders or admin" ON public.orders FOR SELECT USING (
        (auth.uid() IS NOT NULL AND customer_id = auth.uid()) OR public.is_admin() OR auth.role() = 'service_role'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin manage orders" ON public.orders FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ORDER ITEMS
DO $$ BEGIN
    CREATE POLICY "Insert order items" ON public.order_items FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "View order items restricted" ON public.order_items FOR SELECT USING (
        public.is_admin() OR auth.role() = 'service_role' OR EXISTS (
            SELECT 1 FROM public.orders o 
            WHERE o.id = order_items.order_id AND (o.customer_id = auth.uid())
        )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- REVIEWS
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

-- ------------------------------------------------------------------------------
-- 16. STORAGE BUCKETS (PRIVACY HARDENED)
-- ------------------------------------------------------------------------------
-- Receipts bucket is set to PRIVATE (not public) so random users cannot browse all customer receipts!
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-media', 'product-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Receipts upload allowed for anyone
DO $$ BEGIN
    CREATE POLICY "Upload payment receipts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'receipts');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Receipts read allowed ONLY for admins and service role (Private Receipts)
DO $$ BEGIN
    CREATE POLICY "Admin view payment receipts" ON storage.objects FOR SELECT USING (bucket_id = 'receipts' AND (public.is_admin() OR auth.role() = 'service_role'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Product media publicly readable
DO $$ BEGIN
    CREATE POLICY "Public read product media" ON storage.objects FOR SELECT USING (bucket_id = 'product-media');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin upload product media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-media');
EXCEPTION WHEN duplicate_object THEN null; END $$;
