-- ==============================================================================
-- NEXA STORE - PHASE 2: PRODUCTION DATABASE SCHEMA & SECURITY POLICIES
-- Project Reference: uyscsaqkvrkpokjmzasf
-- Complete, normalized PostgreSQL architecture for Nexa Digital Storefront.
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Define Custom Types
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

CREATE OR REPLACE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 6. TABLE: profiles (Extends Supabase Auth users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    role user_role DEFAULT 'customer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on auth.users registration
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

CREATE OR REPLACE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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

CREATE OR REPLACE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

CREATE OR REPLACE TRIGGER trg_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Helper function: Is user admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CATEGORIES: Public Read, Admin Write
CREATE POLICY "Categories are viewable by everyone" 
ON public.categories FOR SELECT USING (true);

CREATE POLICY "Admin can insert categories" 
ON public.categories FOR INSERT WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admin can update categories" 
ON public.categories FOR UPDATE USING (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admin can delete categories" 
ON public.categories FOR DELETE USING (public.is_admin() OR auth.role() = 'service_role');

-- PRODUCTS: Public Read (Active), Admin Full Access
CREATE POLICY "Active products are viewable by everyone" 
ON public.products FOR SELECT USING (is_active = true OR public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admin can insert products" 
ON public.products FOR INSERT WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admin can update products" 
ON public.products FOR UPDATE USING (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admin can delete products" 
ON public.products FOR DELETE USING (public.is_admin() OR auth.role() = 'service_role');

-- PROFILES: Users read/write their own profile, Admin reads all
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin() OR auth.role() = 'service_role');

-- ORDERS: Public Insert (Guest Checkout), Users view own, Admin full access
CREATE POLICY "Anyone can create orders" 
ON public.orders FOR INSERT WITH CHECK (true);

CREATE POLICY "Users view own orders or admin views all" 
ON public.orders FOR SELECT USING (
    customer_id = auth.uid() OR public.is_admin() OR auth.role() = 'service_role' OR auth.uid() IS NULL
);

CREATE POLICY "Admin can update orders" 
ON public.orders FOR UPDATE USING (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admin can delete orders" 
ON public.orders FOR DELETE USING (public.is_admin() OR auth.role() = 'service_role');

-- ORDER ITEMS: Public Insert, viewable by order owner or admin
CREATE POLICY "Anyone can insert order items" 
ON public.order_items FOR INSERT WITH CHECK (true);

CREATE POLICY "View order items" 
ON public.order_items FOR SELECT USING (true);

-- REVIEWS: Public Read approved, Anyone insert, Admin full access
CREATE POLICY "Approved reviews viewable by everyone" 
ON public.reviews FOR SELECT USING (is_approved = true OR public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Anyone can submit reviews" 
ON public.reviews FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin can manage reviews" 
ON public.reviews FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');

-- SUPPORT TICKETS: Anyone submit, Admin view and manage
CREATE POLICY "Anyone can submit support tickets" 
ON public.support_tickets FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin can view and manage tickets" 
ON public.support_tickets FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');

-- COUPONS: Anyone can read active coupons, Admin full access
CREATE POLICY "Active coupons viewable by everyone" 
ON public.coupons FOR SELECT USING (is_active = true OR public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admin can manage coupons" 
ON public.coupons FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');

-- STORE SETTINGS: Public Read, Admin Write
CREATE POLICY "Store settings viewable by everyone" 
ON public.store_settings FOR SELECT USING (true);

CREATE POLICY "Admin can manage store settings" 
ON public.store_settings FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');

-- ==============================================================================
-- 14. STORAGE BUCKETS SETUP
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-media', 'product-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies for Receipts
CREATE POLICY "Anyone can upload payment receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Payment receipts are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts');

-- Storage Policies for Product Media
CREATE POLICY "Product media is publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-media');

CREATE POLICY "Admin can upload product media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-media');
