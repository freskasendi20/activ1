-- ==============================================================================
-- NEXA STORE - COMPLETE PRODUCTION SUPABASE MIGRATION (ALL-IN-ONE)
-- Project Reference: uyscsaqkvrkpokjmzasf
-- Host: aws-1-eu-central-1.pooler.supabase.com
--
-- INSTRUCTIONS:
-- Run this entire script in the Supabase SQL Editor (or via psql / migrations)
-- It safely cleans obsolete tables from the previous app, establishes the
-- full Nexa schema with Row Level Security (RLS) & Storage buckets, and seeds all products.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- STEP 1: SAFE OLD APPLICATION CLEANUP (PRESERVES SUPABASE INFRASTRUCTURE)
-- ------------------------------------------------------------------------------
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
            NULL;
        END;
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- STEP 2: EXTENSIONS & ENUMS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- STEP 3: CORE TABLES
-- ------------------------------------------------------------------------------

-- Categories
CREATE TABLE public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE public.products (
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

CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_featured ON public.products(is_featured);
CREATE INDEX idx_products_active ON public.products(is_active);

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Profiles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    role user_role DEFAULT 'customer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

-- Orders
CREATE TABLE public.orders (
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

CREATE INDEX idx_orders_order_id ON public.orders(order_id);
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Order Items
CREATE TABLE public.order_items (
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

CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);

-- Reviews
CREATE TABLE public.reviews (
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

CREATE INDEX idx_reviews_category ON public.reviews(category);
CREATE INDEX idx_reviews_approved ON public.reviews(is_approved);

-- Support Tickets
CREATE TABLE public.support_tickets (
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

-- Coupons
CREATE TABLE public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL DEFAULT 'fixed',
    discount_value NUMERIC(10, 2) NOT NULL,
    min_spend NUMERIC(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store Settings
CREATE TABLE public.store_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- STEP 4: ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
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

-- Policies
CREATE POLICY "Categories are viewable by everyone" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admin can insert categories" ON public.categories FOR INSERT WITH CHECK (public.is_admin() OR auth.role() = 'service_role');
CREATE POLICY "Admin can update categories" ON public.categories FOR UPDATE USING (public.is_admin() OR auth.role() = 'service_role');
CREATE POLICY "Admin can delete categories" ON public.categories FOR DELETE USING (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Active products viewable by everyone" ON public.products FOR SELECT USING (is_active = true OR public.is_admin() OR auth.role() = 'service_role');
CREATE POLICY "Admin can insert products" ON public.products FOR INSERT WITH CHECK (public.is_admin() OR auth.role() = 'service_role');
CREATE POLICY "Admin can update products" ON public.products FOR UPDATE USING (public.is_admin() OR auth.role() = 'service_role');
CREATE POLICY "Admin can delete products" ON public.products FOR DELETE USING (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Users view own profile or admin" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin() OR auth.role() = 'service_role');
CREATE POLICY "Users update own profile or admin" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Users view own orders or admin" ON public.orders FOR SELECT USING (customer_id = auth.uid() OR public.is_admin() OR auth.role() = 'service_role' OR auth.uid() IS NULL);
CREATE POLICY "Admin can update orders" ON public.orders FOR UPDATE USING (public.is_admin() OR auth.role() = 'service_role');
CREATE POLICY "Admin can delete orders" ON public.orders FOR DELETE USING (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Anyone can insert order items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view order items" ON public.order_items FOR SELECT USING (true);

CREATE POLICY "Approved reviews viewable by everyone" ON public.reviews FOR SELECT USING (is_approved = true OR public.is_admin() OR auth.role() = 'service_role');
CREATE POLICY "Anyone can submit reviews" ON public.reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can manage reviews" ON public.reviews FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Anyone can submit tickets" ON public.support_tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can manage tickets" ON public.support_tickets FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Active coupons viewable by everyone" ON public.coupons FOR SELECT USING (is_active = true OR public.is_admin() OR auth.role() = 'service_role');
CREATE POLICY "Admin can manage coupons" ON public.coupons FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Store settings viewable by everyone" ON public.store_settings FOR SELECT USING (true);
CREATE POLICY "Admin can manage settings" ON public.store_settings FOR ALL USING (public.is_admin() OR auth.role() = 'service_role');

-- ------------------------------------------------------------------------------
-- STEP 5: STORAGE BUCKETS SETUP
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-media', 'product-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ BEGIN
    CREATE POLICY "Anyone can upload payment receipts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'receipts');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Payment receipts are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'receipts');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Product media is publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'product-media');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Admin can upload product media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-media');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- STEP 6: SEED PRODUCTION DATA
-- ------------------------------------------------------------------------------
INSERT INTO public.categories (id, name, icon, description, display_order) VALUES
('ai', 'أدوات الذكاء الاصطناعي', 'fa-solid fa-wand-magic-sparkles', 'ChatGPT Plus · Claude 3.5 · Gemini · Perplexity', 1),
('creative', 'البرامج الإبداعية والتصميم', 'fa-solid fa-palette', 'Adobe CC · Canva Pro · CapCut Pro · Figma', 2),
('office', 'برامج المكتب والإنتاجية', 'fa-solid fa-border-all', 'Microsoft 365 · Notion · Zoom Pro · Coursera', 3),
('streaming', 'الترفيه والاشتراكات', 'fa-solid fa-play', 'YouTube Premium · Spotify · Prime Video', 4),
('gaming', 'الألعاب والبطاقات والحماية', 'fa-solid fa-gamepad', 'Discord Nitro · NordVPN · ProtonVPN', 5);

INSERT INTO public.coupons (code, discount_type, discount_value, min_spend, is_active) VALUES
('NEXA20', 'fixed', 100.00, 200.00, true),
('VIP10', 'fixed', 100.00, 200.00, true),
('NEXA', 'fixed', 100.00, 200.00, true);

INSERT INTO public.store_settings (key, value) VALUES
('payment_vodafone', '{"name": "فودافون كاش", "number": "01225106057", "instructions": "تحويل فوري عبر فودافون كاش مع إرفاق لقطة شاشة للإيصال"}'::jsonb),
('payment_instapay', '{"name": "InstaPay إنستاباي", "ipa": "01225106057", "instructions": "تحويل بنكي لحظي عبر تطبيق إنستاباي مع إرفاق لقطة شاشة للإيصال"}'::jsonb),
('support_contact', '{"phone": "01225106057", "whatsapp": "https://wa.me/201225106057", "email": "support@nexadigital.store"}'::jsonb),
('site_announcement', '{"active": true, "discount": "20%", "text": "خصم 20% على جميع الاشتراكات السنوية لفترة محدودة!"}'::jsonb);

INSERT INTO public.products (id, name, category_id, duration, wholesale_egp, price_egp, price_usd, wholesale_usd, source_bot, is_featured, image, featured_image, rating, rating_count, description, specs, full_desc, activation_guide, warranty, is_active) VALUES
('ai-chatgpt-plus', 'ChatGPT Plus 1M', 'ai', '1 شهر', 700, 1400, 28.00, 12.88, '@snart_store_bot', true, 'logos/chatgpt-plus.webp', 'logos/chatgpt-plus.webp', 4.9, '2.3K', 'اشتراك شات جي بي تي بلس الرسمي يدعم GPT-4o وتوليد الصور عبر DALL-E بلا حدود.', '["وصول غير محدود لنموذج GPT-4o و GPT-4", "توليد وتعديل الصور فائقة الدقة بـ DALL-E 3", "تحليل ملفات البيانات والبرمجة المتقدمة", "تفعيل رسمي وضمان كامل طوال الشهر"]'::jsonb, 'اشتراك ChatGPT Plus الرسمي بحساب خاص مجهز، وصول غير محدود لكل المزايا المتقدمة.', '1. نرسل لك بيانات الدخول عبر واتساب والإيميل.\n2. سجل الدخول مباشرة على chatgpt.com واستمتع بكافة المزايا.', 'ضمان كامل طوال فترة الاشتراك واستبدال فوري عند أي خلل.', true),
('ai-perplexity-pro', 'Perplexity PRO 12M', 'ai', '1 سنة', 750, 1500, 30.00, 14.00, '@RichAIStoreBot', false, 'logos/perplexity.webp', 'logos/perplexity.webp', 4.9, '980', 'محرك البحث الذكي الشامل، يجمع بين كل نماذج الذكاء الاصطناعي في منصة واحدة.', '["أكثر من 300 بحث Pro يومياً", "اختيار النموذج (Claude 3.5 Sonnet, GPT-4o)", "رفع وتحليل ملفات PDF والمستندات بلا حدود", "تفعيل سنوي رسمي مع ضمان"]'::jsonb, 'محرك البحث الذكي الشامل لجميع نماذج الذكاء الاصطناعي مع وصول سنوي Pro.', '1. نرسل لك كود أو رابط تفعيل الاشتراك السنوي.\n2. قم بالربط بحسابك مباشرة.', 'ضمان رسمي لمدة سنة كاملة.', true),
('ai-gemini-18m', 'Google Gemini Advanced 18M', 'ai', '18 شهر', 25, 75, 1.50, 0.49, '@storeBatmanBot', false, 'logos/gemini.webp', 'logos/gemini.webp', 4.8, '1.5K', 'حساب جيميني أدفانسد العملاق بسعة نافذة سياق 1M توكنز و2 تيرابايت مساحة سحابية.', '["نموذج Gemini 1.5 Pro فائق السرعة", "نافذة سياق ضخمة لتحليل الكتب والأفلام", "مساحة Google One السحابية 2TB", "تسليم فوري وتفعيل مباشر"]'::jsonb, 'اشتراك Gemini Advanced لمدة 18 شهراً مع مساحة تخزين 2TB سحابية.', '1. نرسل لك بيانات الحساب الرسمي المجهز.\n2. ابدأ الاستخدام مباشرة على gemini.google.com.', 'ضمان طوال 18 شهر.', true),
('ai-gemini-3m', 'Google Gemini Advanced 3M', 'ai', '3 شهور', 40, 120, 2.40, 0.70, '@storeBatmanBot', false, 'logos/gemini.webp', 'logos/gemini.webp', 4.8, '620', 'باقة جيميني أدفانسد لمدة 3 شهور جاهزة للاستخدام الفوري.', '["Gemini Advanced 1.5 Pro", "سرعة استجابة فائقة", "دعم كامل للغة العربية والإنجليزية", "تسليم فوري"]'::jsonb, 'اشتراك Gemini Advanced لمدة 3 شهور.', '1. استلم الحساب فورا عبر واتساب.\n2. سجل دخولك على جوجل.', 'ضمان استبدال فوري طوال الـ 3 شهور.', true),
('ai-claude-pro', 'Claude 3.5 Sonnet Pro', 'ai', '1 شهر', 650, 1350, 27.00, 12.00, '@RichAIStoreBot', false, 'logos/claude.webp', 'logos/claude.webp', 4.9, '1.8K', 'أقوى نموذج ذكاء اصطناعي للبرمجة وكتابة المحتوى الأكاديمي والتحليل العميق.', '["وصول غير محدود لـ Claude 3.5 Sonnet", "ميزة Artifacts التفاعلية لتطوير التطبيقات", "أعلى دقة برمجية ولغوية في العالم", "حساب خاص مضمون 100%"]'::jsonb, 'اشتراك Claude Pro الرسمي لكافة المهام البرمجية والتطويرية.', '1. نرسل لك الحساب الخاص بك مفعل مسبقا.\n2. سجل الدخول على claude.ai مباشرة.', 'ضمان كامل طوال الشهر.', true),
('ai-midjourney-standard', 'Midjourney Standard Plan', 'ai', '1 شهر', 900, 1600, 32.00, 16.50, '@RichAIStoreBot', false, 'logos/midjourney.webp', 'logos/midjourney.webp', 4.9, '3.1K', 'المنصة رقم 1 عالمياً لتوليد الصور الخيالية والفنية بأعلى جودة واحترافية.', '["15 ساعة Fast GPU لتوليد الصور بسرعة", "توليد غير محدود في وضع Relax", "حقوق الاستخدام التجاري الكاملة", "وصول حصري لمعرض الأعضاء"]'::jsonb, 'اشتراك Midjourney Standard الرسمي عبر ديسكورد.', '1. تسليم فوري لحساب ديسكورد مجهز باشتراك مفعل.\n2. انضم وابدأ التوليد فورا.', 'ضمان طوال مدة الاشتراك.', true),
('cr-capcut-pro-1y', 'CapCut Pro 1 Year', 'creative', '1 سنة', 120, 360, 7.20, 2.30, '@RichAIStoreBot', true, 'logos/capcut-pro.webp', 'logos/capcut-pro.webp', 4.9, '5.4K', 'الاشتراك الأقوى لصناع المحتوى ومحرري الفيديو، تفعيل سنوي رسمي بكافة الميزات.', '["تصدير بدقة 4K 60FPS بدون علامة مائية", "جميع القوالب والتأثيرات الصوتية والذكاء الاصطناعي Pro", "توليد نصوص وترجمة تلقائية فائقة الدقة", "يعمل على الهاتف، الكمبيوتر والويب"]'::jsonb, 'اشتراك CapCut Pro السنوي لإنتاج مقاطع الفيديو باحترافية.', '1. نرسل لك بيانات الحساب المجهز.\n2. سجل الدخول في تطبيق CapCut على الهاتف أو الكمبيوتر.', 'ضمان استبدال فوري لمدة سنة كاملة.', true),
('cr-canva-pro-edu', 'Canva Pro Lifetime / 1Y', 'creative', '1 سنة', 30, 90, 1.80, 0.58, '@storeBatmanBot', false, 'logos/canva.webp', 'logos/canva.webp', 4.9, '12.8K', 'وصول كامل لجميع قوالب وتصاميم كانفا الاحترافية وإزالة الخلفيات بنقرة واحدة.', '["أكثر من 100 مليون صورة وقالب وفيديو Pro", "أدوات الذكاء الاصطناعي Magic Resize و BG Remover", "مساحة تخزين سحابية ضخمة 1TB", "تفعيل مباشر على إيميلك الشخصي"]'::jsonb, 'اشتراك كانفا برو الرسمي لتصميم السوشيال ميديا والعروض التقديمية.', '1. نرسل لك رابط دعوة مباشر للانضمام.\n2. اضغط على الرابط وسيتفعل اشتراكك فورا على إيميلك الشخصي.', 'ضمان رسمي كامل.', true),
('cr-adobe-all-apps', 'Adobe Creative Cloud All Apps 1M', 'creative', '1 شهر', 850, 1550, 31.00, 15.80, '@snart_store_bot', false, 'logos/adobe-cc.webp', 'logos/adobe-cc.webp', 4.9, '4.2K', 'الحزمة الإبداعية الكاملة تضم Photoshop, Illustrator, Premiere, After Effects والمزيد.', '["أكثر من 20 تطبيق إبداعي رسمي أصلي", "100GB مساحة سحابية و Adobe Fonts", "تحديثات مستمرة من السحابة مباشرة", "تفعيل على حسابك الشخصي أو حساب جاهز"]'::jsonb, 'الحزمة الكاملة لكافة برامج أدوبي الإبداعية الأصلية.', '1. تفعيل على إيميلك الشخصي أو تسليم حساب مجهز.\n2. حمل البرامج من Adobe Creative Cloud الرسمي.', 'ضمان رسمي كامل طوال الشهر.', true),
('cr-figma-pro', 'Figma Professional 1 Year', 'creative', '1 سنة', 150, 450, 9.00, 2.90, '@storeBatmanBot', false, 'logos/figma.webp', 'logos/figma.webp', 4.8, '1.1K', 'اشتراك فيجما للمصممين المحترفين وفرق العمل، مشاريع ومكتبات غير محدودة.', '["مشاريع وتصاميم غير محدودة", "مكتبات مكونات Team Libraries مشتركة", "تاريخ نسخ غير محدود للملفات", "تفعيل سنوي مضمون"]'::jsonb, 'اشتراك فيجما برو السنوي لتصميم واجهات المستخدم UI/UX.', '1. دعوة رسمية لحسابك الخاص.\n2. وصول غير محدود لكل خصائص Pro.', 'ضمان سنوي كامل.', true),
('of-microsoft-365', 'Microsoft 365 Family / Pro 1Y', 'office', '1 سنة', 90, 270, 5.40, 1.75, '@storeBatmanBot', true, 'logos/office-365.webp', 'logos/office-365.webp', 4.9, '8.9K', 'باقة أوفيس 365 الرسمية مع Word, Excel, PowerPoint و 1TB تخزين OneDrive سحابي.', '["Word, Excel, PowerPoint, Outlook", "1 تيرابايت مساحة تخزين ون درايف آمنة", "يعمل على 5 أجهزة (ويندوز، ماك، آيفون، أندرويد)", "تحديثات أمنية ورسمية مستمرة"]'::jsonb, 'حزمة ميكروسوفت أوفيس 365 الرسمية لمدة عام كامل مع 1TB OneDrive.', '1. نرسل لك كود تفعيل أو بيانات الحساب الرسمي.\n2. ادخل على setup.office.com وحمل التطبيقات.', 'ضمان رسمي لمدة سنة كاملة.', true),
('of-notion-plus', 'Notion Plus 1 Year', 'office', '1 سنة', 80, 240, 4.80, 1.55, '@storeBatmanBot', false, 'logos/notion.webp', 'logos/notion.webp', 4.9, '2.1K', 'منصة تنظيم العمل والملاحظات وإدارة المشاريع الأكثر إنتاجية عالمياً.', '["صفحات وبلوكات غير محدودة", "مزامنة سريعة ودعم رفع ملفات بحجم غير محدود", "Notion AI متقدم لتلخيص وتوليد النصوص", "تفعيل سنوي رسمي"]'::jsonb, 'اشتراك نوشن بلس السنوي لإدارة المشاريع وملاحظات العمل.', '1. دعوة مباشرة على إيميلك المسجل في نوشن.\n2. تفعيل تلقائي فوري.', 'ضمان رسمي لمدة عام كامل.', true),
('of-coursera-plus', 'Coursera Plus 1 Year', 'office', '1 سنة', 350, 750, 15.00, 6.80, '@RichAIStoreBot', false, 'logos/coursera.webp', 'logos/coursera.webp', 4.9, '3.5K', 'وصول غير محدود لأكثر من 7,000 كورس وشهادة احترافية معتمدة من كبرى الجامعات والشركات.', '["شهادات معتمدة من Google, IBM, Meta", "أكثر من 7,000 دورة تدريبية ومسار تخصصي", "تطبيق عملي ومشاريع حقيقية", "تفعيل سنوي رسمي على حسابك"]'::jsonb, 'اشتراك كورسيرا بلس السنوي لتعلم المهارات والشهادات المعتمدة.', '1. ترقية رسمية على حسابك الشخصي في كورسيرا.\n2. وصول لكل الكورسات والشهادات فورا.', 'ضمان رسمي لمدة عام.', true),
('st-youtube-premium', 'YouTube Premium 1 Year', 'streaming', '1 سنة', 180, 540, 10.80, 3.50, '@RichAIStoreBot', true, 'logos/youtube-premium.webp', 'logos/youtube-premium.webp', 4.9, '15.2K', 'مشاهدة يوتيوب بدون إعلانات نهائياً، مع تشغيل في الخلفية وتحميل وتطبيق YouTube Music.', '["تصفح وتشغيل الفيديوهات بدون أي إعلانات", "تشغيل الفيديوهات في الخلفية وعند قفل الشاشة", "تحميل الفيديوهات بجودة عالية للمشاهدة بدون إنترنت", "اشتراك YouTube Music مدمج مجاناً", "تفعيل رسمي عائلي على إيميلك الشخصي"]'::jsonb, 'اشتراك يوتيوب بريميوم السنوي الرسمي على حسابك الشخصي.', '1. نرسل لك رابط دعوة عائلية على إيميلك الشخصي في جيميل.\n2. اقبل الدعوة وسيتفعل يوتيوب بريميوم فوراً.', 'ضمان رسمي كامل طوال السنة.', true),
('st-spotify-premium', 'Spotify Premium 1 Year', 'streaming', '1 سنة', 120, 360, 7.20, 2.30, '@RichAIStoreBot', false, 'logos/spotify.webp', 'logos/spotify.webp', 4.8, '9.7K', 'استماع غير محدود للموسيقى والبودكاست بأعلى جودة صوتية وبدون إعلانات.', '["استماع بدون إعلانات مع تخطي غير محدود", "تحميل الأغاني والبودكاست للاستماع بدون إنترنت", "جودة صوت نقية فائقة Very High 320kbps", "تفعيل على حسابك الشخصي أو حساب مجهز"]'::jsonb, 'اشتراك سبوتيفاي بريميوم السنوي.', '1. نرسل لك رابط تفعيل على حسابك أو حساب مجهز.\n2. استمتع بكل المزايا فورا.', 'ضمان كامل طوال الـ 12 شهرا.', true),
('st-prime-video', 'Amazon Prime Video 6 Months', 'streaming', '6 شهور', 90, 270, 5.40, 1.75, '@storeBatmanBot', false, 'logos/primevideo.webp', 'logos/primevideo.webp', 4.7, '4.1K', 'مشاهدة أحدث الأفلام والمسلسلات الحصرية من أمازون برايم بدقة 4K UHD.', '["مكتبة أفلام ومسلسلات حصرية وأصلية", "جودة بث فائقة 4K HDR مع صوت محيطي", "دعم الترجمة والدبلجة العربية الكاملة", "حساب خاص أو شاشة خاصة مع PIN"]'::jsonb, 'اشتراك أمازون برايم فيديو لمدة 6 شهور بدقة 4K.', '1. نرسل لك بيانات الحساب والشاشة المخصصة لك مع PIN.\n2. شاهد أفلامك ومسلسلاتك المفضلة فوراً.', 'ضمان استبدال فوري طوال 6 شهور.', true),
('gm-discord-nitro', 'Discord Nitro 1 Year', 'gaming', '1 سنة', 450, 950, 19.00, 8.80, '@RichAIStoreBot', true, 'logos/discord-nitro.webp', 'logos/discord-nitro.webp', 4.9, '6.8K', 'الترقية الكاملة لديسكورد: إيموجيز مخصصة في كل السيرفرات وبث شاشة 4K وبوستات مجانية.', '["بث شاشة بدقة 4K 60FPS فائقة الوضوح", "استخدام الإيموجيز والستيكرز في أي سيرفر", "2 Server Boosts مجاناً شهرياً", "شارة Nitro المميزة وصورة متحركة GIF"]'::jsonb, 'اشتراك ديسكورد نيترو السنوي الكامل.', '1. نرسل لك رابط جيفت رسمي أو تفعيل مباشر.\n2. استمتع بمزايا نيترو فوراً على حسابك.', 'ضمان سنوي كامل.', true),
('gm-nordvpn-1y', 'NordVPN Ultimate 1 Year', 'gaming', '1 سنة', 120, 360, 7.20, 2.30, '@storeBatmanBot', false, 'logos/nordvpn.webp', 'logos/nordvpn.webp', 4.8, '5.3K', 'شبكة VPN الأسرع والأكثر أماناً في العالم لتأمين الاتصال وفتح المحتوى المحجوب.', '["أكثر من 5,500 سيرفر في 60 دولة", "تشفير عسكري من الجيل التالي وحماية من البرمجيات الخبيثة", "حماية Kill Switch وسياسة عدم الاحتفاظ بالسجلات No-Logs", "يعمل على 6 أجهزة في نفس الوقت"]'::jsonb, 'اشتراك نورد في بي إن السنوي لتأمين الخصوصية والاتصال.', '1. نرسل لك بيانات الحساب الرسمي المجهز.\n2. حمل تطبيق NordVPN وسجل دخولك فوراً.', 'ضمان سنوي كامل.', true);

COMMIT;
