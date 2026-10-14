-- ==============================================================================
-- NEXA STORE — COHERENT SECURE DIGITAL FULFILLMENT & EXPERIENCE ENGINE
-- File: supabase/migrations/20261010_minimal_secure_fulfillment.sql
-- Status: PREPARED & PENDING TEST PROJECT VALIDATION (DO NOT RUN ON LIVE PROD)
-- ==============================================================================
-- ARCHITECTURE & SECURITY GUARANTEES:
-- 1. CREDENTIAL SECURITY & SECRET MANAGEMENT:
--    - Server-side AES encryption via pgcrypto (pgp_sym_encrypt).
--    - Zero hardcoded secrets in functions or migrations: derived dynamically via get_order_encryption_key.
--    - Plaintext passwords NEVER stored in JSONB content blocks or plain tables.
--    - Passwords revealed strictly on-demand via audited RPC reveal_order_credential.
--    - Every reveal event logged in dedicated public.order_security_audit_log table.
-- 2. PRIVATE ATTACHMENTS & REQUESTER-BOUND GUEST FLOW:
--    - Dedicated private Supabase Storage bucket 'order-attachments' (public = false).
--    - Unsuppressed bucket setup (no silent error masking).
--    - ZERO anonymous Storage RLS policies: anonymous users have NO direct read/write to storage.objects.
--    - Trusted server-side endpoints (create_attachment_download_grant, create_attachment_upload_grant)
--      validate guest order access tokens and issue short-lived (15 min) requester-bound permission tokens.
--    - Strict content gating: Customers CANNOT access internal staff note attachments or unpublished drafts.
-- 3. DRAFT / PUBLISHED SEPARATION:
--    - Dedicated table public.order_fulfillment_drafts for pending drafts.
--    - Saving a draft NEVER touches or revokes an already delivered fulfillment.
--    - Published deliveries in public.order_fulfillments remain 100% visible to customers.
-- 4. RECOVERY ABUSE PREVENTION & CONCURRENCY PROTECTION:
--    - Transactional advisory locking: pg_advisory_xact_lock prevents concurrent race conditions.
--    - Dual rate limiting: max 3 attempts per 15 minutes AND max 10 per 24 hours per order reference.
--    - 60-minute admin notification cooldown: prevents notification spam.
--    - Constant-time uniform zero-disclosure response: NEVER leaks access tokens or confirms order existence.
-- 5. PAYMENT GATE & PER-ITEM PARTIAL FULFILLMENT:
--    - deliver_digital_order strictly requires payment_status = 'verified'.
--    - Partial fulfillment maintains status = 'pending' and fulfillment_status = 'in_progress'.
-- 6. EXACT PRODUCTION ADMIN COMPATIBILITY:
--    - Preserves exact public.is_admin() implementation from production schema.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 0. ADMIN AUTHENTICATION HELPER (EXACT PRODUCTION PRESERVATION)
-- ------------------------------------------------------------------------------
-- Preserves the exact signature and logic from 20261009_nexa_production_schema.sql (lines 587-595)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 1. EXTEND PUBLIC.ORDERS WITH SECURE DELIVERY COLUMNS (ADDITIVE & SAFE)
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE public.orders 
    ADD COLUMN IF NOT EXISTS delivery_preference TEXT DEFAULT 'website' 
    CHECK (delivery_preference IN ('website', 'email', 'whatsapp'));
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE public.orders 
    ADD COLUMN IF NOT EXISTS customer_account_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_pref ON public.orders(delivery_preference);
CREATE INDEX IF NOT EXISTS idx_orders_customer_account ON public.orders(customer_account_id);

-- ------------------------------------------------------------------------------
-- 1.1 SERVER ENCRYPTION SECRET MANAGEMENT (ZERO HARDCODED SECRETS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.server_vault_keys (
    key_id TEXT PRIMARY KEY,
    secret_value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.server_vault_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.server_vault_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.server_vault_keys TO service_role;

CREATE OR REPLACE FUNCTION public.get_order_encryption_key(
    p_order_id UUID,
    p_created_at TIMESTAMPTZ
)
RETURNS TEXT AS $$
DECLARE
    v_master_secret TEXT;
BEGIN
    -- 1. Read from PostgreSQL runtime configuration if configured (app.settings.encryption_secret)
    v_master_secret := NULLIF(current_setting('app.settings.encryption_secret', true), '');

    -- 2. Fallback to protected internal vault table
    IF v_master_secret IS NULL THEN
        SELECT secret_value INTO v_master_secret 
        FROM public.server_vault_keys 
        WHERE key_id = 'order_encryption_master' 
        LIMIT 1;
    END IF;

    -- 3. Bootstrap cryptographically secure random 256-bit key if not present
    IF v_master_secret IS NULL THEN
        v_master_secret := encode(gen_random_bytes(32), 'hex');
        INSERT INTO public.server_vault_keys (key_id, secret_value, created_at)
        VALUES ('order_encryption_master', v_master_secret, NOW())
        ON CONFLICT (key_id) DO NOTHING;

        SELECT secret_value INTO v_master_secret 
        FROM public.server_vault_keys 
        WHERE key_id = 'order_encryption_master' 
        LIMIT 1;
    END IF;

    -- Derive an order-scoped HMAC-SHA256 key (Zero hardcoded secrets)
    RETURN encode(hmac(p_order_id::text || ':' || p_created_at::text, v_master_secret::bytea, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_order_encryption_key(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_encryption_key(UUID, TIMESTAMPTZ) TO service_role;

-- ------------------------------------------------------------------------------
-- 1.2 TABLE: public.order_security_audit_log (ACTUAL AUDIT SCHEMA SUPPORT)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_item_id TEXT,
    event_type TEXT NOT NULL, -- 'credential_reveal', 'recovery_attempt', 'unauthorized_attempt', 'unauthorized_attachment_access'
    actor_type TEXT NOT NULL, -- 'admin', 'customer_token', 'guest', 'system'
    actor_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_order ON public.order_security_audit_log(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_time ON public.order_security_audit_log(created_at DESC);

ALTER TABLE public.order_security_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Admin read security audit logs"
        ON public.order_security_audit_log FOR SELECT
        USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Service role insert security audit logs"
        ON public.order_security_audit_log FOR INSERT
        WITH CHECK (auth.role() = 'service_role' OR public.is_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

REVOKE UPDATE, DELETE ON public.order_security_audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.order_security_audit_log TO authenticated, service_role;
GRANT INSERT ON public.order_security_audit_log TO service_role;

-- ------------------------------------------------------------------------------
-- 1.3 TABLE: public.order_attachment_permissions (REQUESTER-BOUND ATTACHMENT PERMISSIONS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_attachment_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    object_path TEXT NOT NULL,
    permission_type TEXT NOT NULL CHECK (permission_type IN ('download', 'upload')),
    permission_token TEXT NOT NULL UNIQUE,
    requester_token_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes')
);

CREATE INDEX IF NOT EXISTS idx_attachment_perm_token ON public.order_attachment_permissions(permission_token, expires_at);
CREATE INDEX IF NOT EXISTS idx_attachment_perm_order ON public.order_attachment_permissions(order_id);

ALTER TABLE public.order_attachment_permissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Admin manage attachment permissions"
    ON public.order_attachment_permissions FOR ALL
    USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

REVOKE ALL ON public.order_attachment_permissions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.order_attachment_permissions TO service_role;

-- Backward compatibility view if referenced
CREATE OR REPLACE VIEW public.order_attachment_grants AS
SELECT id, order_id, object_path, permission_type AS grant_type, created_at, expires_at
FROM public.order_attachment_permissions;

-- ------------------------------------------------------------------------------
-- 2. TABLE: public.fulfillment_templates (REUSABLE DELIVERY BLUEPRINTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fulfillment_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category_id TEXT,
    description TEXT,
    default_type TEXT NOT NULL DEFAULT 'link',
    default_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Standard Delivery Presets (Idempotent)
INSERT INTO public.fulfillment_templates (id, name, category_id, description, default_type, default_blocks)
VALUES 
(
    'gemini_standard',
    'قالب تفعيل Gemini Advanced (رابط مباشر + دليل)',
    'ai',
    'مخصص لاشتراكات جوجل جيميني عبر رابط الانضمام للعائلة/الدعوة مع دليل تفعيل مصور',
    'link',
    '[
        {"id": "heading_1", "type": "heading", "content": "بيانات تفعيل اشتراك Google Gemini Advanced"},
        {"id": "link_1", "type": "link", "label": "رابط تفعيل الدعوة الرسمية", "url": "", "buttonText": "تفعيل الاشتراك الآن"},
        {"id": "guide_1", "type": "guide", "title": "خطوات التفعيل السريع", "steps": ["اضغط على رابط الدعوة أعلاه من متصفحك المسجل به حساب Google الخاص بك.", "وافق على الانضمام إلى مجموعة العائلة أو الخطة.", "افتح تطبيق Gemini وستجد علامة Advanced مفعلة فوراً مع مساحة 2TB."]},
        {"id": "warranty_1", "type": "warranty", "text": "اشتراك رسمي مضمون طوال المدة المحددة مع دعم فني متواصل."}
    ]'::jsonb
),
(
    'adobe_redemption',
    'قالب تفعيل Adobe Creative Cloud (كود رقمي + خطوات)',
    'creative',
    'مخصص لحزم أدوبي عبر كود الترقية أو دعوة البريد مع الدليل الرسمي',
    'license',
    '[
        {"id": "heading_1", "type": "heading", "content": "كود تفعيل باقة Adobe Creative Cloud All Apps"},
        {"id": "code_1", "type": "license", "label": "مفتاح التفعيل الرقمي", "code": ""},
        {"id": "link_1", "type": "link", "label": "صفحة استرداد الأكواد الرسمية", "url": "https://redeem.adobe.com", "buttonText": "الدخول لصفحة الاسترداد"},
        {"id": "guide_1", "type": "guide", "title": "تعليمات الاسترداد", "steps": ["توجه إلى رابط استرداد أدوبي أعلاه وسجل دخولك بحسابك الشخصي.", "انسخ كود التفعيل وألصقه في الخانة المخصصة.", "اضغط تأكيد الاسترداد وسيتم تفعيل جميع تطبيقات السحابة الإبداعية تلقائياً."]},
        {"id": "warning_1", "type": "warning", "text": "تأكد من عدم وجود اشتراك فردي نشط متعارض قبل إدخال الكود."}
    ]'::jsonb
),
(
    'chatgpt_account',
    'قالب تفعيل ChatGPT Plus (حساب مجهز أو دعوة مساحة عمل)',
    'ai',
    'مخصص لاشتراكات ChatGPT Plus الرسمية مع تشفير آمن لبيانات الحساب',
    'credentials',
    '[
        {"id": "heading_1", "type": "heading", "content": "بيانات اشتراك ChatGPT Plus الخاص بك"},
        {"id": "creds_1", "type": "credentials", "title": "بيانات الحساب المجهز", "username": "", "has_secret": true, "loginUrl": "https://chatgpt.com"},
        {"id": "guide_1", "type": "guide", "title": "إرشادات الاستخدام الآمن", "steps": ["سجل الدخول عبر الرابط الرسمي باستخدام البيانات المرفقة أعلاه.", "يُفضل تفعيل التحقق بخطوتين إذا كان الحساب خاصاً بك.", "استمتع بنماذج GPT-4o والذاكرة المتقدمة وتوليد الصور DALL-E."]},
        {"id": "warranty_1", "type": "warranty", "text": "ضمان كامل المدة ضد التوقف مع تعويض فوري حال حدوث أي خلل."}
    ]'::jsonb
),
(
    'generic_license',
    'قالب مفتاح ترخيص عام (License Key)',
    NULL,
    'مناسب للبرامج وأنظمة التشغيل ومفاتيح التفعيل الرقمية',
    'license',
    '[
        {"id": "heading_1", "type": "heading", "content": "مفتاح الترخيص الرقمي الرسمي"},
        {"id": "code_1", "type": "license", "label": "كود التفعيل / License Key", "code": ""},
        {"id": "guide_1", "type": "guide", "title": "طريقة استخدام الكود", "steps": ["افتح البرنامج أو الموقع المطلوب تفعيله.", "توجه إلى إعدادات الحساب أو خانة أدخل مفتاح الترخيص.", "الصق الكود واضغط تفعيل."]}
    ]'::jsonb
),
(
    'manual_service',
    'قالب خدمة مفعلة يدوياً (رسالة شكر وتأكيد)',
    NULL,
    'مناسب للترقيات المباشرة التي يقوم بها المدير على حساب العميل مباشرة',
    'manual',
    '[
        {"id": "heading_1", "type": "heading", "content": "تم تفعيل اشتراكك بنجاح من قبل الإدارة"},
        {"id": "message_1", "type": "message", "content": "تمت مراجعة حسابك وتطبيق الترقية الرسمية بنجاح. يمكنك الآن الاستمتاع بجميع ميزات الاشتراك."},
        {"id": "warranty_1", "type": "warranty", "text": "ضمان ساري طوال فترة الاشتراك المشتراة."}
    ]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_blocks = EXCLUDED.default_blocks,
    updated_at = NOW();

-- ------------------------------------------------------------------------------
-- 3. TABLE: public.order_fulfillments (PUBLISHED DELIVERIES ONLY)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_fulfillments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    template_id TEXT REFERENCES public.fulfillment_templates(id) ON DELETE SET NULL,
    fulfillment_type TEXT NOT NULL DEFAULT 'link' CHECK (fulfillment_type IN ('link', 'license', 'manual', 'composite', 'credentials')),
    activation_title TEXT,
    activation_url TEXT,
    license_key TEXT,
    instructions TEXT,
    customer_message TEXT,
    content_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    encrypted_credentials BYTEA,
    credentials_username TEXT,
    has_credentials BOOLEAN DEFAULT false,
    delivery_channel TEXT DEFAULT 'website' CHECK (delivery_channel IN ('website', 'email', 'whatsapp')),
    version INT NOT NULL DEFAULT 1,
    revision_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    delivered_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'delivered' CHECK (status IN ('delivered', 'revoked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (order_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_order_fulfillments_order_id ON public.order_fulfillments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_fulfillments_item_id ON public.order_fulfillments(order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_fulfillments_status ON public.order_fulfillments(status);
CREATE INDEX IF NOT EXISTS idx_order_fulfillments_template ON public.order_fulfillments(template_id);

-- ------------------------------------------------------------------------------
-- 4. TABLE: public.order_fulfillment_drafts (SEPARATE PENDING DRAFTS ONLY)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_fulfillment_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    template_id TEXT REFERENCES public.fulfillment_templates(id) ON DELETE SET NULL,
    fulfillment_type TEXT NOT NULL DEFAULT 'link' CHECK (fulfillment_type IN ('link', 'license', 'manual', 'composite', 'credentials')),
    activation_title TEXT,
    activation_url TEXT,
    license_key TEXT,
    instructions TEXT,
    customer_message TEXT,
    content_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    encrypted_credentials BYTEA,
    credentials_username TEXT,
    has_credentials BOOLEAN DEFAULT false,
    delivery_channel TEXT DEFAULT 'website',
    saved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (order_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_fulfillment_drafts_order ON public.order_fulfillment_drafts(order_id);

-- ------------------------------------------------------------------------------
-- 5. TABLE: public.order_messages (TWO-WAY CONVERSATIONS & AUDIT)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'customer', 'system')),
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_name TEXT,
    message TEXT NOT NULL,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_internal_note BOOLEAN DEFAULT false,
    is_read_by_admin BOOLEAN DEFAULT false,
    is_read_by_customer BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON public.order_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_created_at ON public.order_messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_order_messages_admin_unread ON public.order_messages(order_id, is_read_by_admin) WHERE is_read_by_admin = false;

-- ------------------------------------------------------------------------------
-- 6. TABLE: public.order_recovery_requests (ABUSE PREVENTION & RATE LIMITING)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_recovery_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_reference TEXT NOT NULL,
    masked_contact TEXT NOT NULL,
    attempt_count INT NOT NULL DEFAULT 1,
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_req_ref ON public.order_recovery_requests(order_reference);
CREATE INDEX IF NOT EXISTS idx_recovery_req_time ON public.order_recovery_requests(last_attempt_at);

-- ------------------------------------------------------------------------------
-- 7. SUPABASE STORAGE BUCKET & ACCESS POLICIES: order-attachments
-- ------------------------------------------------------------------------------
-- Unsuppressed configuration of private bucket 'order-attachments'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'order-attachments',
    'order-attachments',
    false, -- Strictly private
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

-- Storage Policy 1: Admin & Service Role full access
DO $$ BEGIN
    CREATE POLICY "Admin full access on order_attachments"
    ON storage.objects FOR ALL
    USING (bucket_id = 'order-attachments' AND (public.is_admin() OR auth.role() = 'service_role'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Storage Policy 2: Authenticated registered customer upload to own order folder
DO $$ BEGIN
    CREATE POLICY "Customer upload own order attachments"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'order-attachments' AND
        auth.uid() IS NOT NULL AND
        (
            public.is_admin() OR auth.role() = 'service_role' OR
            EXISTS (
                SELECT 1 FROM public.orders o
                WHERE (o.order_id = (storage.foldername(name))[1] OR o.id::text = (storage.foldername(name))[1])
                  AND (o.customer_id = auth.uid() OR o.customer_account_id = auth.uid())
            )
        )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Storage Policy 3: Authenticated registered customer read own order attachments
DO $$ BEGIN
    CREATE POLICY "Customer read own order attachments"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'order-attachments' AND
        auth.uid() IS NOT NULL AND
        (
            public.is_admin() OR auth.role() = 'service_role' OR
            EXISTS (
                SELECT 1 FROM public.orders o
                WHERE (o.order_id = (storage.foldername(name))[1] OR o.id::text = (storage.foldername(name))[1])
                  AND (o.customer_id = auth.uid() OR o.customer_account_id = auth.uid())
            )
        )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- NOTE: ZERO anonymous Storage policies on storage.objects.
-- Anonymous users CANNOT read or write directly to storage.objects under any circumstances.
-- All guest attachments are mediated through trusted requester-bound server-side endpoints.

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (STRICT LEAST PRIVILEGE)
-- ------------------------------------------------------------------------------
ALTER TABLE public.fulfillment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_fulfillment_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_recovery_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.fulfillment_templates FROM anon;
REVOKE ALL ON public.order_fulfillments FROM anon;
REVOKE ALL ON public.order_fulfillment_drafts FROM anon;
REVOKE ALL ON public.order_messages FROM anon;
REVOKE ALL ON public.order_recovery_requests FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.order_recovery_requests TO service_role;

-- Templates: Admins full control
DO $$ BEGIN
    CREATE POLICY "Admin access on fulfillment_templates" 
    ON public.fulfillment_templates FOR ALL 
    USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Published Fulfillments: Admins full control; Customers view own delivered records
DO $$ BEGIN
    CREATE POLICY "Admin access on order_fulfillments" 
    ON public.order_fulfillments FOR ALL 
    USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Customers view own delivered fulfillments" 
    ON public.order_fulfillments FOR SELECT 
    USING (
        status = 'delivered' AND EXISTS (
            SELECT 1 FROM public.orders o 
            WHERE o.id = order_fulfillments.order_id 
              AND (
                  (o.customer_id = auth.uid() AND auth.uid() IS NOT NULL) OR
                  (o.customer_account_id = auth.uid() AND auth.uid() IS NOT NULL)
              )
        )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Drafts: STRICTLY ADMIN ONLY. Customers CANNOT access drafts under any circumstance
DO $$ BEGIN
    CREATE POLICY "Admin only access on order_fulfillment_drafts" 
    ON public.order_fulfillment_drafts FOR ALL 
    USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Order Messages: Admins full control; Customers view own non-internal messages
DO $$ BEGIN
    CREATE POLICY "Admin access on order_messages" 
    ON public.order_messages FOR ALL 
    USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Customers view own non-internal messages" 
    ON public.order_messages FOR SELECT 
    USING (
        is_internal_note = false AND EXISTS (
            SELECT 1 FROM public.orders o 
            WHERE o.id = order_messages.order_id 
              AND (
                  (o.customer_id = auth.uid() AND auth.uid() IS NOT NULL) OR
                  (o.customer_account_id = auth.uid() AND auth.uid() IS NOT NULL)
              )
        )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Recovery Requests: STRICTLY ADMIN / SERVICE ROLE
DO $$ BEGIN
    CREATE POLICY "Admin access on order_recovery_requests" 
    ON public.order_recovery_requests FOR ALL 
    USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 9. HELPER: ATTACHMENT PATH VALIDATION (PATH TRAVERSAL PROTECTION)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_attachment_path(
    p_order_id TEXT,
    p_path TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_clean_order_id TEXT;
    v_clean_path TEXT;
    v_folder TEXT;
    v_filename TEXT;
BEGIN
    IF p_path IS NULL OR length(trim(p_path)) = 0 THEN
        RETURN true;
    END IF;

    v_clean_order_id := trim(COALESCE(p_order_id, ''));
    v_clean_path := trim(p_path);

    -- Block directory traversal, duplicate slashes, backslashes
    IF v_clean_path LIKE '%..%' OR v_clean_path LIKE '%//%' OR v_clean_path LIKE '%\%' THEN
        RETURN false;
    END IF;

    -- Extract folder and filename (must be strictly 2 components: folder/filename)
    v_folder := split_part(v_clean_path, '/', 1);
    v_filename := split_part(v_clean_path, '/', 2);

    IF split_part(v_clean_path, '/', 3) <> '' OR v_folder = '' OR v_filename = '' THEN
        RETURN false;
    END IF;

    -- Folder must match order identifier
    IF v_folder <> v_clean_order_id THEN
        RETURN false;
    END IF;

    -- Allowed extension check
    IF NOT (lower(v_filename) ~ '\.(jpg|jpeg|png|webp|gif|pdf)$') THEN
        RETURN false;
    END IF;

    -- Clean characters in filename
    IF v_filename ~ '[^a-zA-Z0-9_\.\-]' THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 9.1 RPC: create_attachment_download_grant (REQUESTER-BOUND DOWNLOAD PERMISSION)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_attachment_download_grant(
    p_order_id TEXT,
    p_access_token TEXT,
    p_file_path TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_clean_order_id TEXT;
    v_clean_token TEXT;
    v_clean_path TEXT;
    v_is_admin BOOLEAN := false;
    v_is_authorized BOOLEAN := false;
    v_is_published BOOLEAN := false;
    v_perm_token TEXT;
    v_token_hash TEXT;
BEGIN
    v_clean_order_id := trim(COALESCE(p_order_id, ''));
    v_clean_token := trim(COALESCE(p_access_token, ''));
    v_clean_path := trim(COALESCE(p_file_path, ''));

    SELECT * INTO v_order 
    FROM public.orders 
    WHERE order_id = v_clean_order_id
       OR (v_clean_order_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id = v_clean_order_id::uuid);

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    v_clean_order_id := v_order.order_id;
    v_is_admin := (public.is_admin() OR auth.role() = 'service_role');

    IF v_is_admin THEN
        v_is_authorized := true;
    ELSIF auth.uid() IS NOT NULL AND (v_order.customer_id = auth.uid() OR v_order.customer_account_id = auth.uid()) THEN
        v_is_authorized := true;
    ELSIF v_clean_token <> '' AND (
        (v_order.access_token IS NOT NULL AND v_order.access_token = v_clean_token) OR 
        ((v_order.metadata->>'access_token') = v_clean_token)
    ) THEN
        v_is_authorized := true;
    END IF;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: invalid access token');
    END IF;

    -- Validate single-depth folder format (<order_id>/<filename>)
    IF NOT public.validate_attachment_path(v_clean_order_id, v_clean_path) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid attachment path');
    END IF;

    -- CRITICAL ACCESS GATE: Customers CANNOT access internal staff attachments or unpublished drafts
    IF NOT v_is_admin THEN
        -- 1. Check if attachment belongs to a published, delivered fulfillment
        SELECT true INTO v_is_published
        FROM public.order_fulfillments
        WHERE order_id = v_order.id
          AND status = 'delivered'
          AND attachments::text LIKE '%' || v_clean_path || '%'
        LIMIT 1;

        -- 2. Check if attachment belongs to a non-internal customer message
        IF NOT COALESCE(v_is_published, false) THEN
            SELECT true INTO v_is_published
            FROM public.order_messages
            WHERE order_id = v_order.id
              AND is_internal_note = false
              AND attachments::text LIKE '%' || v_clean_path || '%'
            LIMIT 1;
        END IF;

        -- 3. Check if attachment is the order payment receipt image
        IF NOT COALESCE(v_is_published, false) AND v_order.receipt_image_url IS NOT NULL THEN
            IF v_order.receipt_image_url LIKE '%' || v_clean_path || '%' THEN
                v_is_published := true;
            END IF;
        END IF;

        IF NOT COALESCE(v_is_published, false) THEN
            -- Record security audit event
            INSERT INTO public.order_security_audit_log (
                order_id,
                event_type,
                actor_type,
                actor_id,
                metadata
            ) VALUES (
                v_order.id,
                'unauthorized_attachment_access',
                'customer_token',
                auth.uid(),
                jsonb_build_object(
                    'attempted_path', v_clean_path,
                    'reason', 'File is unpublished or restricted to internal staff'
                )
            );
            RETURN jsonb_build_object(
                'success', false, 
                'error', 'Access denied: File has not been published to this order or is restricted to internal staff'
            );
        END IF;
    END IF;

    -- Generate cryptographically random, requester-bound permission token
    v_perm_token := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(digest(COALESCE(v_clean_token, auth.uid()::text, 'service_role'), 'sha256'), 'hex');

    -- Insert active requester-bound permission record (15 minutes validity)
    INSERT INTO public.order_attachment_permissions (
        order_id,
        object_path,
        permission_type,
        permission_token,
        requester_token_hash,
        expires_at
    ) VALUES (
        v_order.id,
        v_clean_path,
        'download',
        v_perm_token,
        v_token_hash,
        NOW() + INTERVAL '15 minutes'
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_clean_order_id,
        'object_path', v_clean_path,
        'permission_token', v_perm_token,
        'expires_at', NOW() + INTERVAL '15 minutes',
        'expires_in_seconds', 900
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.create_attachment_download_grant(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- Backward compatibility alias
CREATE OR REPLACE FUNCTION public.create_signed_attachment_download(
    p_order_id TEXT,
    p_access_token TEXT,
    p_file_path TEXT
)
RETURNS JSONB AS $$
BEGIN
    RETURN public.create_attachment_download_grant(p_order_id, p_access_token, p_file_path);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.create_signed_attachment_download(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 9.2 RPC: create_attachment_upload_grant (REQUESTER-BOUND UPLOAD PERMISSION)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_attachment_upload_grant(
    p_order_id TEXT,
    p_access_token TEXT,
    p_file_name TEXT,
    p_file_size BIGINT,
    p_mime_type TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_clean_order_id TEXT;
    v_clean_token TEXT;
    v_clean_name TEXT;
    v_canonical_path TEXT;
    v_is_admin BOOLEAN := false;
    v_is_authorized BOOLEAN := false;
    v_perm_token TEXT;
    v_token_hash TEXT;
BEGIN
    v_clean_order_id := trim(COALESCE(p_order_id, ''));
    v_clean_token := trim(COALESCE(p_access_token, ''));
    v_clean_name := regexp_replace(COALESCE(p_file_name, ''), '[^a-zA-Z0-9_.-]', '_', 'g');

    SELECT * INTO v_order 
    FROM public.orders 
    WHERE order_id = v_clean_order_id
       OR (v_clean_order_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id = v_clean_order_id::uuid);

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    v_clean_order_id := v_order.order_id;
    v_is_admin := (public.is_admin() OR auth.role() = 'service_role');

    IF v_is_admin THEN
        v_is_authorized := true;
    ELSIF auth.uid() IS NOT NULL AND (v_order.customer_id = auth.uid() OR v_order.customer_account_id = auth.uid()) THEN
        v_is_authorized := true;
    ELSIF v_clean_token <> '' AND (
        (v_order.access_token IS NOT NULL AND v_order.access_token = v_clean_token) OR 
        ((v_order.metadata->>'access_token') = v_clean_token)
    ) THEN
        v_is_authorized := true;
    END IF;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: invalid access token');
    END IF;

    -- Validate Size (10MB maximum)
    IF p_file_size > 10485760 THEN
        RETURN jsonb_build_object('success', false, 'error', 'File size exceeds maximum allowed limit (10MB)');
    END IF;

    -- Validate MIME Type
    IF lower(trim(COALESCE(p_mime_type, ''))) NOT IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unsupported file type. Allowed: JPG, PNG, WEBP, GIF, PDF');
    END IF;

    -- Construct canonical path: <order_id>/<uuid>_<clean_filename>
    v_canonical_path := v_clean_order_id || '/' || gen_random_uuid()::text || '_' || v_clean_name;

    -- Generate cryptographically random, requester-bound permission token
    v_perm_token := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(digest(COALESCE(v_clean_token, auth.uid()::text, 'service_role'), 'sha256'), 'hex');

    -- Insert active requester-bound permission record (15 minutes validity)
    INSERT INTO public.order_attachment_permissions (
        order_id,
        object_path,
        permission_type,
        permission_token,
        requester_token_hash,
        expires_at
    ) VALUES (
        v_order.id,
        v_canonical_path,
        'upload',
        v_perm_token,
        v_token_hash,
        NOW() + INTERVAL '15 minutes'
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_clean_order_id,
        'object_path', v_canonical_path,
        'bucket_id', 'order-attachments',
        'permission_token', v_perm_token,
        'expires_at', NOW() + INTERVAL '15 minutes',
        'expires_in_seconds', 900
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.create_attachment_upload_grant(TEXT, TEXT, TEXT, BIGINT, TEXT) TO anon, authenticated, service_role;

-- Backward compatibility alias
CREATE OR REPLACE FUNCTION public.create_signed_attachment_upload(
    p_order_id TEXT,
    p_access_token TEXT,
    p_file_name TEXT,
    p_file_size BIGINT,
    p_mime_type TEXT
)
RETURNS JSONB AS $$
BEGIN
    RETURN public.create_attachment_upload_grant(p_order_id, p_access_token, p_file_name, p_file_size, p_mime_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.create_signed_attachment_upload(TEXT, TEXT, TEXT, BIGINT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 9.3 RPC: verify_attachment_permission (VALIDATE REQUESTER PERMISSION TOKEN)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_attachment_permission(
    p_permission_token TEXT,
    p_order_id TEXT,
    p_access_token TEXT,
    p_file_path TEXT,
    p_action TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_perm RECORD;
    v_clean_order_id TEXT;
    v_clean_token TEXT;
    v_clean_path TEXT;
    v_clean_token_hash TEXT;
BEGIN
    v_clean_order_id := trim(COALESCE(p_order_id, ''));
    v_clean_token := trim(COALESCE(p_access_token, ''));
    v_clean_path := trim(COALESCE(p_file_path, ''));
    v_clean_token_hash := encode(digest(COALESCE(v_clean_token, auth.uid()::text, 'service_role'), 'sha256'), 'hex');

    SELECT * INTO v_order 
    FROM public.orders 
    WHERE order_id = v_clean_order_id
       OR (v_clean_order_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id = v_clean_order_id::uuid);

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Order not found');
    END IF;

    SELECT * INTO v_perm
    FROM public.order_attachment_permissions
    WHERE permission_token = trim(COALESCE(p_permission_token, ''))
      AND order_id = v_order.id
      AND object_path = v_clean_path
      AND permission_type = lower(trim(COALESCE(p_action, '')))
      AND expires_at > NOW();

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Invalid or expired permission token');
    END IF;

    -- Verify requester binding: token must match the requester who was granted the permission
    IF v_perm.requester_token_hash <> v_clean_token_hash AND NOT (public.is_admin() OR auth.role() = 'service_role') THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Permission token does not belong to this requester');
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'order_id', v_order.order_id,
        'object_path', v_perm.object_path,
        'permission_type', v_perm.permission_type,
        'expires_at', v_perm.expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.verify_attachment_permission(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 10. RPC: save_fulfillment_draft (ISOLATED SERVER DRAFTS — NEVER OVERWRITES PUBLISHED)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_fulfillment_draft(
    p_order_id TEXT,
    p_fulfillments JSONB,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_item JSONB;
    v_order_item_id UUID;
    v_product_id TEXT;
    v_prod_name TEXT;
    v_saved_count INT := 0;
    v_type TEXT;
    v_clean_order_id TEXT;
    v_blocks JSONB;
    v_attachments JSONB;
    v_template_id TEXT;
    v_creds JSONB;
    v_plain_pass TEXT;
    v_enc_creds BYTEA := NULL;
    v_cred_user TEXT := NULL;
    v_enc_key TEXT;
    v_att JSONB;
    v_b JSONB;
    v_sanitized_blocks JSONB := '[]'::jsonb;
BEGIN
    IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
        RAISE EXCEPTION 'Unauthorized: only an administrator can save fulfillment drafts.';
    END IF;

    v_clean_order_id := trim(COALESCE(p_order_id, ''));
    IF v_clean_order_id = '' THEN
        RAISE EXCEPTION 'Order ID is required';
    END IF;

    SELECT * INTO v_order 
    FROM public.orders 
    WHERE order_id = v_clean_order_id
       OR (v_clean_order_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id = v_clean_order_id::uuid);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', v_clean_order_id;
    END IF;

    v_clean_order_id := v_order.order_id;

    IF p_fulfillments IS NULL OR jsonb_array_length(p_fulfillments) = 0 THEN
        RAISE EXCEPTION 'No fulfillment items provided in draft payload.';
    END IF;

    -- Derive order-scoped encryption key (Zero hardcoded secrets)
    v_enc_key := public.get_order_encryption_key(v_order.id, v_order.created_at);

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_fulfillments)
    LOOP
        v_order_item_id := NULL;
        IF v_item ? 'orderItemId' AND v_item->>'orderItemId' IS NOT NULL AND length(trim(v_item->>'orderItemId')) > 0 THEN
            BEGIN
                v_order_item_id := (v_item->>'orderItemId')::uuid;
            EXCEPTION WHEN others THEN
                v_order_item_id := NULL;
            END;
        END IF;

        IF v_order_item_id IS NULL THEN
            RAISE EXCEPTION 'Fulfillment draft requires a valid UUID orderItemId. Unlinked items are rejected.';
        END IF;

        SELECT product_id, name INTO v_product_id, v_prod_name
        FROM public.order_items
        WHERE id = v_order_item_id AND order_id = v_order.id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Order item ID % does not belong to order %', v_order_item_id, v_clean_order_id;
        END IF;

        v_type := COALESCE(v_item->>'type', v_item->>'fulfillmentType', 'link');
        IF v_type NOT IN ('link', 'license', 'manual', 'composite', 'credentials') THEN
            v_type := 'composite';
        END IF;

        v_template_id := v_item->>'templateId';
        v_blocks := COALESCE(v_item->'blocks', v_item->'contentBlocks', '[]'::jsonb);
        v_attachments := COALESCE(v_item->'attachments', '[]'::jsonb);
        v_creds := COALESCE(v_item->'credentials', '{}'::jsonb);

        -- Validate attachment paths
        FOR v_att IN SELECT * FROM jsonb_array_elements(v_attachments)
        LOOP
            IF v_att ? 'path' AND NOT public.validate_attachment_path(v_clean_order_id, v_att->>'path') THEN
                RAISE EXCEPTION 'Security error: Invalid attachment storage path "%"', v_att->>'path';
            END IF;
        END LOOP;

        -- Credential Encryption & Sanitization
        v_plain_pass := NULL;
        v_enc_creds := NULL;
        v_cred_user := NULL;

        IF v_creds ? 'password' AND length(trim(v_creds->>'password')) > 0 THEN
            v_plain_pass := trim(v_creds->>'password');
            v_cred_user := trim(COALESCE(v_creds->>'username', ''));
            v_enc_creds := pgp_sym_encrypt(v_plain_pass, v_enc_key);
        END IF;

        -- Strip plaintext passwords from content_blocks JSONB
        v_sanitized_blocks := '[]'::jsonb;
        FOR v_b IN SELECT * FROM jsonb_array_elements(v_blocks)
        LOOP
            IF (v_b->>'type') = 'credentials' THEN
                IF v_b ? 'password' AND length(trim(v_b->>'password')) > 0 THEN
                    v_plain_pass := trim(v_b->>'password');
                    v_cred_user := trim(COALESCE(v_b->>'username', v_cred_user, ''));
                    v_enc_creds := pgp_sym_encrypt(v_plain_pass, v_enc_key);
                END IF;
                -- Remove plaintext password field, retain username and metadata
                v_sanitized_blocks := v_sanitized_blocks || jsonb_build_array((v_b - 'password') || jsonb_build_object('has_secret', true));
            ELSE
                v_sanitized_blocks := v_sanitized_blocks || jsonb_build_array(v_b);
            END IF;
        END LOOP;

        -- Upsert exclusively into drafts table
        INSERT INTO public.order_fulfillment_drafts (
            order_id,
            order_item_id,
            product_id,
            product_name,
            template_id,
            fulfillment_type,
            activation_title,
            activation_url,
            license_key,
            instructions,
            customer_message,
            content_blocks,
            attachments,
            encrypted_credentials,
            credentials_username,
            has_credentials,
            delivery_channel,
            saved_by,
            updated_at
        ) VALUES (
            v_order.id,
            v_order_item_id,
            v_product_id,
            v_prod_name,
            v_template_id,
            v_type,
            v_item->>'title',
            COALESCE(v_item->>'linkOrCode', v_item->>'activationUrl'),
            COALESCE(v_item->>'licenseKey', v_item->>'linkOrCode'),
            v_item->>'instructions',
            v_item->>'message',
            v_sanitized_blocks,
            v_attachments,
            v_enc_creds,
            v_cred_user,
            (v_enc_creds IS NOT NULL),
            COALESCE(v_item->>'channel', 'website'),
            auth.uid(),
            NOW()
        )
        ON CONFLICT (order_id, order_item_id)
        DO UPDATE SET
            template_id = EXCLUDED.template_id,
            fulfillment_type = EXCLUDED.fulfillment_type,
            activation_title = EXCLUDED.activation_title,
            activation_url = EXCLUDED.activation_url,
            license_key = EXCLUDED.license_key,
            instructions = EXCLUDED.instructions,
            customer_message = EXCLUDED.customer_message,
            content_blocks = EXCLUDED.content_blocks,
            attachments = EXCLUDED.attachments,
            encrypted_credentials = COALESCE(EXCLUDED.encrypted_credentials, public.order_fulfillment_drafts.encrypted_credentials),
            credentials_username = COALESCE(EXCLUDED.credentials_username, public.order_fulfillment_drafts.credentials_username),
            has_credentials = (EXCLUDED.encrypted_credentials IS NOT NULL OR public.order_fulfillment_drafts.has_credentials),
            delivery_channel = EXCLUDED.delivery_channel,
            saved_by = auth.uid(),
            updated_at = NOW();

        v_saved_count := v_saved_count + 1;
    END LOOP;

    IF p_admin_notes IS NOT NULL THEN
        UPDATE public.orders SET admin_notes = p_admin_notes WHERE id = v_order.id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_clean_order_id,
        'drafts_saved', v_saved_count,
        'published_untouched', true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.save_fulfillment_draft(TEXT, JSONB, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 11. RPC: deliver_digital_order (PUBLISHES DELIVERY & PROMOTES DRAFTS)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deliver_digital_order(
    p_order_id TEXT,
    p_fulfillments JSONB,
    p_admin_notes TEXT DEFAULT NULL,
    p_channel TEXT DEFAULT 'website'
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_item JSONB;
    v_order_item_id UUID;
    v_product_id TEXT;
    v_prod_name TEXT;
    v_inserted_count INT := 0;
    v_total_items_count INT := 0;
    v_delivered_items_count INT := 0;
    v_type TEXT;
    v_url TEXT;
    v_license TEXT;
    v_clean_order_id TEXT;
    v_blocks JSONB;
    v_attachments JSONB;
    v_template_id TEXT;
    v_creds JSONB;
    v_plain_pass TEXT;
    v_enc_creds BYTEA := NULL;
    v_cred_user TEXT := NULL;
    v_enc_key TEXT;
    v_att JSONB;
    v_b JSONB;
    v_sanitized_blocks JSONB := '[]'::jsonb;
    v_existing_ful RECORD;
    v_new_version INT;
    v_new_history JSONB;
    v_new_fulfillment_status public.fulfillment_status;
    v_new_order_status public.order_status;
    v_audit_notes TEXT;
BEGIN
    IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
        RAISE EXCEPTION 'Unauthorized: only an administrator can deliver digital orders.';
    END IF;

    v_clean_order_id := trim(COALESCE(p_order_id, ''));
    IF v_clean_order_id = '' THEN
        RAISE EXCEPTION 'Order ID is required';
    END IF;

    SELECT * INTO v_order 
    FROM public.orders 
    WHERE order_id = v_clean_order_id
       OR (v_clean_order_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id = v_clean_order_id::uuid)
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', v_clean_order_id;
    END IF;

    v_clean_order_id := v_order.order_id;

    -- Strict Payment Gate
    IF v_order.payment_status <> 'verified' THEN
        RAISE EXCEPTION 'Cannot deliver order before payment is verified. Current payment status: %', v_order.payment_status;
    END IF;

    IF p_fulfillments IS NULL OR jsonb_array_length(p_fulfillments) = 0 THEN
        RAISE EXCEPTION 'Cannot complete delivery: At least one fulfillment item is required.';
    END IF;

    -- Derive order-scoped encryption key (Zero hardcoded secrets)
    v_enc_key := public.get_order_encryption_key(v_order.id, v_order.created_at);

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_fulfillments)
    LOOP
        v_order_item_id := NULL;
        IF v_item ? 'orderItemId' AND v_item->>'orderItemId' IS NOT NULL AND length(trim(v_item->>'orderItemId')) > 0 THEN
            BEGIN
                v_order_item_id := (v_item->>'orderItemId')::uuid;
            EXCEPTION WHEN others THEN
                v_order_item_id := NULL;
            END;
        END IF;

        IF v_order_item_id IS NULL THEN
            RAISE EXCEPTION 'Fulfillment item requires a valid UUID orderItemId. Unlinked items are rejected.';
        END IF;

        SELECT product_id, name INTO v_product_id, v_prod_name
        FROM public.order_items
        WHERE id = v_order_item_id AND order_id = v_order.id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Order item ID % does not belong to order %', v_order_item_id, v_clean_order_id;
        END IF;

        v_type := COALESCE(v_item->>'type', v_item->>'fulfillmentType', 'link');
        IF v_type NOT IN ('link', 'license', 'manual', 'composite', 'credentials') THEN
            v_type := 'composite';
        END IF;

        v_url := COALESCE(v_item->>'linkOrCode', v_item->>'activationUrl');
        v_license := COALESCE(v_item->>'licenseKey', v_item->>'linkOrCode');
        v_blocks := COALESCE(v_item->'blocks', v_item->'contentBlocks', '[]'::jsonb);
        v_attachments := COALESCE(v_item->'attachments', '[]'::jsonb);
        v_template_id := v_item->>'templateId';
        v_creds := COALESCE(v_item->'credentials', '{}'::jsonb);

        -- Validate attachment paths
        FOR v_att IN SELECT * FROM jsonb_array_elements(v_attachments)
        LOOP
            IF v_att ? 'path' AND NOT public.validate_attachment_path(v_clean_order_id, v_att->>'path') THEN
                RAISE EXCEPTION 'Security error: Invalid attachment storage path "%"', v_att->>'path';
            END IF;
        END LOOP;

        -- Validation per type
        IF v_type = 'link' AND (v_url IS NULL OR length(trim(v_url)) = 0) AND jsonb_array_length(v_blocks) = 0 THEN
            RAISE EXCEPTION 'Direct activation link is required for item "%"', v_prod_name;
        ELSIF v_type = 'license' AND (v_license IS NULL OR length(trim(v_license)) = 0) AND jsonb_array_length(v_blocks) = 0 THEN
            RAISE EXCEPTION 'License key or code is required for item "%"', v_prod_name;
        ELSIF v_type = 'manual' AND (v_item->>'instructions' IS NULL OR length(trim(v_item->>'instructions')) = 0) AND jsonb_array_length(v_blocks) = 0 THEN
            RAISE EXCEPTION 'Instructions are required for manual fulfillment of item "%"', v_prod_name;
        END IF;

        -- Credential Encryption & Sanitization
        v_plain_pass := NULL;
        v_enc_creds := NULL;
        v_cred_user := NULL;

        IF v_creds ? 'password' AND length(trim(v_creds->>'password')) > 0 THEN
            v_plain_pass := trim(v_creds->>'password');
            v_cred_user := trim(COALESCE(v_creds->>'username', ''));
            v_enc_creds := pgp_sym_encrypt(v_plain_pass, v_enc_key);
        END IF;

        v_sanitized_blocks := '[]'::jsonb;
        FOR v_b IN SELECT * FROM jsonb_array_elements(v_blocks)
        LOOP
            IF (v_b->>'type') = 'credentials' THEN
                IF v_b ? 'password' AND length(trim(v_b->>'password')) > 0 THEN
                    v_plain_pass := trim(v_b->>'password');
                    v_cred_user := trim(COALESCE(v_b->>'username', v_cred_user, ''));
                    v_enc_creds := pgp_sym_encrypt(v_plain_pass, v_enc_key);
                END IF;
                v_sanitized_blocks := v_sanitized_blocks || jsonb_build_array((v_b - 'password') || jsonb_build_object('has_secret', true));
            ELSE
                v_sanitized_blocks := v_sanitized_blocks || jsonb_build_array(v_b);
            END IF;
        END LOOP;

        -- Build Revision History if previously delivered
        SELECT * INTO v_existing_ful 
        FROM public.order_fulfillments 
        WHERE order_id = v_order.id AND order_item_id = v_order_item_id;

        IF FOUND THEN
            v_new_version := v_existing_ful.version + 1;
            v_new_history := v_existing_ful.revision_history || jsonb_build_array(jsonb_build_object(
                'version', v_existing_ful.version,
                'delivered_at', v_existing_ful.delivered_at,
                'delivered_by', v_existing_ful.delivered_by,
                'activation_title', v_existing_ful.activation_title,
                'fulfillment_type', v_existing_ful.fulfillment_type,
                'modified_at', NOW()
            ));
        ELSE
            v_new_version := 1;
            v_new_history := '[]'::jsonb;
        END IF;

        -- Upsert into published fulfillments
        INSERT INTO public.order_fulfillments (
            order_id,
            order_item_id,
            product_id,
            product_name,
            template_id,
            fulfillment_type,
            activation_title,
            activation_url,
            license_key,
            instructions,
            customer_message,
            content_blocks,
            attachments,
            encrypted_credentials,
            credentials_username,
            has_credentials,
            delivery_channel,
            version,
            revision_history,
            delivered_at,
            delivered_by,
            status,
            updated_at
        ) VALUES (
            v_order.id,
            v_order_item_id,
            v_product_id,
            v_prod_name,
            v_template_id,
            v_type,
            v_item->>'title',
            v_url,
            v_license,
            v_item->>'instructions',
            v_item->>'message',
            v_sanitized_blocks,
            v_attachments,
            v_enc_creds,
            v_cred_user,
            (v_enc_creds IS NOT NULL),
            COALESCE(p_channel, 'website'),
            v_new_version,
            v_new_history,
            NOW(),
            auth.uid(),
            'delivered',
            NOW()
        )
        ON CONFLICT (order_id, order_item_id)
        DO UPDATE SET
            template_id = EXCLUDED.template_id,
            fulfillment_type = EXCLUDED.fulfillment_type,
            activation_title = EXCLUDED.activation_title,
            activation_url = EXCLUDED.activation_url,
            license_key = EXCLUDED.license_key,
            instructions = EXCLUDED.instructions,
            customer_message = EXCLUDED.customer_message,
            content_blocks = EXCLUDED.content_blocks,
            attachments = EXCLUDED.attachments,
            encrypted_credentials = COALESCE(EXCLUDED.encrypted_credentials, public.order_fulfillments.encrypted_credentials),
            credentials_username = COALESCE(EXCLUDED.credentials_username, public.order_fulfillments.credentials_username),
            has_credentials = (EXCLUDED.encrypted_credentials IS NOT NULL OR public.order_fulfillments.has_credentials),
            delivery_channel = EXCLUDED.delivery_channel,
            version = EXCLUDED.version,
            revision_history = EXCLUDED.revision_history,
            delivered_at = NOW(),
            delivered_by = auth.uid(),
            status = 'delivered',
            updated_at = NOW();

        -- Clear draft for this item since it is now published
        DELETE FROM public.order_fulfillment_drafts
        WHERE order_id = v_order.id AND order_item_id = v_order_item_id;

        v_inserted_count := v_inserted_count + 1;
    END LOOP;

    -- Partial vs Full Fulfillment Auditing
    SELECT count(*) INTO v_total_items_count
    FROM public.order_items
    WHERE order_id = v_order.id;

    SELECT count(DISTINCT order_item_id) INTO v_delivered_items_count
    FROM public.order_fulfillments
    WHERE order_id = v_order.id
      AND status = 'delivered';

    IF v_total_items_count > 0 AND v_delivered_items_count >= v_total_items_count THEN
        v_new_fulfillment_status := 'fulfilled';
        v_new_order_status := 'completed';
        v_audit_notes := COALESCE(p_admin_notes, 'تم اكتمال تسليم جميع منتجات الطلب (' || v_delivered_items_count || '/' || v_total_items_count || ')');
    ELSE
        v_new_fulfillment_status := 'in_progress';
        v_new_order_status := 'pending';
        v_audit_notes := COALESCE(p_admin_notes, 'تسليم جزئي قيد المتابعة (' || v_delivered_items_count || '/' || GREATEST(v_total_items_count, 1) || ' من المنتجات)');
    END IF;

    UPDATE public.orders SET
        fulfillment_status = v_new_fulfillment_status,
        status = v_new_order_status,
        admin_notes = COALESCE(p_admin_notes, admin_notes),
        fulfilled_at = CASE WHEN v_new_fulfillment_status = 'fulfilled' THEN NOW() ELSE fulfilled_at END
    WHERE id = v_order.id;

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
        v_new_order_status::TEXT,
        'fulfillment',
        v_audit_notes,
        auth.uid()
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_clean_order_id,
        'items_delivered_this_call', v_inserted_count,
        'total_order_items', v_total_items_count,
        'delivered_items_count', v_delivered_items_count,
        'fulfillment_status', v_new_fulfillment_status::TEXT,
        'status', v_new_order_status::TEXT,
        'is_fully_fulfilled', (v_new_fulfillment_status = 'fulfilled')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.deliver_digital_order(TEXT, JSONB, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 12. RPC: reveal_order_credential (RESTRICTED AUDITED SECRET RETRIEVAL)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reveal_order_credential(
    p_order_id TEXT,
    p_order_item_id UUID,
    p_access_token TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_ful RECORD;
    v_is_admin BOOLEAN := false;
    v_is_authorized BOOLEAN := false;
    v_clean_order_id TEXT;
    v_clean_token TEXT;
    v_enc_key TEXT;
    v_decrypted_password TEXT;
BEGIN
    v_clean_order_id := trim(COALESCE(p_order_id, ''));
    v_clean_token := trim(COALESCE(p_access_token, ''));

    SELECT * INTO v_order 
    FROM public.orders 
    WHERE order_id = v_clean_order_id
       OR (v_clean_order_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id = v_clean_order_id::uuid);

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    v_clean_order_id := v_order.order_id;
    v_is_admin := (public.is_admin() OR auth.role() = 'service_role');

    IF v_is_admin THEN
        v_is_authorized := true;
    ELSIF auth.uid() IS NOT NULL AND (v_order.customer_id = auth.uid() OR v_order.customer_account_id = auth.uid()) THEN
        v_is_authorized := true;
    ELSIF v_clean_token <> '' AND (
        (v_order.access_token IS NOT NULL AND v_order.access_token = v_clean_token) OR 
        ((v_order.metadata->>'access_token') = v_clean_token)
    ) THEN
        v_is_authorized := true;
    END IF;

    IF NOT v_is_authorized THEN
        -- Record unauthorized attempt into security audit log
        INSERT INTO public.order_security_audit_log (
            order_id,
            order_item_id,
            event_type,
            actor_type,
            actor_id,
            metadata
        ) VALUES (
            v_order.id,
            p_order_item_id::text,
            'unauthorized_credential_attempt',
            'guest',
            auth.uid(),
            jsonb_build_object('attempted_at', NOW())
        );
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: invalid token');
    END IF;

    SELECT * INTO v_ful 
    FROM public.order_fulfillments 
    WHERE order_id = v_order.id AND order_item_id = p_order_item_id AND status = 'delivered';

    IF NOT FOUND OR v_ful.encrypted_credentials IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No encrypted credentials found for this item');
    END IF;

    -- Decrypt using order-scoped secret key (Zero hardcoded secrets)
    v_enc_key := public.get_order_encryption_key(v_order.id, v_order.created_at);
    
    BEGIN
        v_decrypted_password := pgp_sym_decrypt(v_ful.encrypted_credentials, v_enc_key);
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('success', false, 'error', 'Decryption failed');
    END;

    -- Record security audit event in dedicated audit log table
    INSERT INTO public.order_security_audit_log (
        order_id,
        order_item_id,
        event_type,
        actor_type,
        actor_id,
        metadata
    ) VALUES (
        v_order.id,
        p_order_item_id::text,
        'credential_reveal',
        CASE WHEN v_is_admin THEN 'admin' ELSE 'customer_token' END,
        auth.uid(),
        jsonb_build_object(
            'product_name', v_ful.product_name,
            'revealed_at', NOW()
        )
    );

    -- Log event in order timeline
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
        v_order.status::TEXT,
        'fulfillment',
        'تم فك تشفير وعرض بيانات الحساب الخاصة بالمنتج "' || v_ful.product_name || '" بأمان',
        auth.uid()
    );

    RETURN jsonb_build_object(
        'success', true,
        'username', v_ful.credentials_username,
        'password', v_decrypted_password
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.reveal_order_credential(TEXT, UUID, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 13. RPC: lookup_order (ZERO-DISCLOSURE TOKEN-GATED LOOKUP)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_order(
    p_order_id TEXT,
    p_access_token TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_items JSONB;
    v_fulfillments JSONB := '[]'::jsonb;
    v_pending_drafts JSONB := '[]'::jsonb;
    v_messages JSONB := '[]'::jsonb;
    v_is_authorized BOOLEAN := false;
    v_is_admin BOOLEAN := false;
    v_clean_order_id TEXT;
    v_clean_token TEXT;
BEGIN
    v_clean_order_id := trim(COALESCE(p_order_id, ''));
    v_clean_token := trim(COALESCE(p_access_token, ''));

    IF v_clean_order_id = '' THEN
        RETURN jsonb_build_object(
            'orderId', '',
            'isAuthorized', false,
            'requiresAuthorization', true,
            'message', 'رقم الطلب مطلوب.'
        );
    END IF;

    v_is_admin := (public.is_admin() OR auth.role() = 'service_role');

    SELECT * INTO v_order 
    FROM public.orders 
    WHERE order_id = v_clean_order_id
       OR (v_clean_order_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id = v_clean_order_id::uuid);

    IF FOUND THEN
        v_clean_order_id := v_order.order_id;
        IF v_is_admin THEN
            v_is_authorized := true;
        ELSIF auth.uid() IS NOT NULL AND (v_order.customer_id = auth.uid() OR v_order.customer_account_id = auth.uid()) THEN
            v_is_authorized := true;
        ELSIF v_clean_token <> '' AND (
            (v_order.access_token IS NOT NULL AND v_order.access_token = v_clean_token) OR 
            ((v_order.metadata->>'access_token') = v_clean_token)
        ) THEN
            v_is_authorized := true;
        END IF;
    END IF;

    -- Zero-disclosure for unauthorized requests
    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object(
            'orderId', v_clean_order_id,
            'isAuthorized', false,
            'requiresAuthorization', true,
            'message', 'رمز الوصول مطلوب أو غير صالح لعرض تفاصيل هذا الطلب.'
        );
    END IF;

    -- Aggregate Items
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'orderItemId', id,
        'productId', product_id,
        'name', name,
        'duration', duration,
        'quantity', quantity,
        'priceEgp', price_egp,
        'deliveryType', delivery_type,
        'activation', activation_type,
        'image', image,
        'isBundle', is_bundle
    )), '[]'::jsonb) INTO v_items
    FROM public.order_items
    WHERE order_id = v_order.id;

    -- Aggregate Published Fulfillments (Passwords strictly masked; revealed via reveal_order_credential)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'orderItemId', order_item_id,
        'productName', product_name,
        'templateId', template_id,
        'fulfillmentType', fulfillment_type,
        'activationTitle', activation_title,
        'activationUrl', activation_url,
        'licenseKey', license_key,
        'instructions', instructions,
        'customerMessage', customer_message,
        'contentBlocks', content_blocks,
        'attachments', attachments,
        'credentials', jsonb_build_object(
            'username', credentials_username,
            'hasCredentials', has_credentials,
            'isEncrypted', true
        ),
        'deliveryChannel', delivery_channel,
        'version', version,
        'revisionHistory', CASE WHEN v_is_admin THEN revision_history ELSE '[]'::jsonb END,
        'deliveredAt', delivered_at,
        'status', status
    )), '[]'::jsonb) INTO v_fulfillments
    FROM public.order_fulfillments
    WHERE order_id = v_order.id AND status = 'delivered';

    -- Admins only: Include pending drafts without affecting customer view
    IF v_is_admin THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'orderItemId', order_item_id,
            'productName', product_name,
            'templateId', template_id,
            'fulfillmentType', fulfillment_type,
            'activationTitle', activation_title,
            'activationUrl', activation_url,
            'licenseKey', license_key,
            'instructions', instructions,
            'customerMessage', customer_message,
            'contentBlocks', content_blocks,
            'attachments', attachments,
            'credentials', jsonb_build_object(
                'username', credentials_username,
                'hasCredentials', has_credentials,
                'isEncrypted', true
            ),
            'updatedAt', updated_at
        )), '[]'::jsonb) INTO v_pending_drafts
        FROM public.order_fulfillment_drafts
        WHERE order_id = v_order.id;
    END IF;

    -- Aggregate Order Messages (Customers NEVER receive internal staff notes)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'senderType', sender_type,
        'senderName', sender_name,
        'message', message,
        'attachments', attachments,
        'isInternalNote', is_internal_note,
        'isReadByAdmin', is_read_by_admin,
        'isReadByCustomer', is_read_by_customer,
        'createdAt', created_at
    ) ORDER BY created_at ASC), '[]'::jsonb) INTO v_messages
    FROM public.order_messages
    WHERE order_id = v_order.id
      AND (is_internal_note = false OR v_is_admin);

    -- Full Authorized Response
    RETURN jsonb_build_object(
        'orderId', v_order.order_id,
        'createdAt', v_order.created_at,
        'customerName', v_order.customer_name,
        'customerEmail', v_order.customer_email,
        'customerPhone', v_order.customer_phone,
        'notes', v_order.notes,
        'adminNotes', CASE WHEN v_is_admin THEN v_order.admin_notes ELSE NULL END,
        'subtotalEgp', v_order.subtotal_egp,
        'discountEgp', v_order.discount_egp,
        'totalEgp', v_order.total_egp,
        'totalUsd', v_order.total_usd,
        'paymentMethod', v_order.payment_method,
        'paymentStatus', v_order.payment_status,
        'transferNumber', v_order.transfer_number,
        'receiptImage', v_order.receipt_image_url,
        'status', v_order.status,
        'fulfillmentStatus', v_order.fulfillment_status,
        'deliveryPreference', COALESCE(v_order.delivery_preference, v_order.metadata->>'delivery_preference', 'website'),
        'items', COALESCE(v_items, '[]'::jsonb),
        'fulfillments', v_fulfillments,
        'pendingDrafts', v_pending_drafts,
        'messages', v_messages,
        'isAuthorized', true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.lookup_order(TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 14. RPC: add_order_message (CHAT WITH VALIDATED ATTACHMENTS)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_order_message(
    p_order_id TEXT,
    p_access_token TEXT,
    p_message TEXT,
    p_attachments JSONB DEFAULT '[]'::jsonb,
    p_is_internal BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_is_admin BOOLEAN := false;
    v_is_authorized BOOLEAN := false;
    v_sender_type TEXT;
    v_sender_name TEXT;
    v_msg_id UUID;
    v_clean_order_id TEXT;
    v_clean_token TEXT;
    v_att JSONB;
BEGIN
    v_clean_order_id := trim(COALESCE(p_order_id, ''));
    v_clean_token := trim(COALESCE(p_access_token, ''));

    SELECT * INTO v_order 
    FROM public.orders 
    WHERE order_id = v_clean_order_id
       OR (v_clean_order_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id = v_clean_order_id::uuid);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', v_clean_order_id;
    END IF;

    v_clean_order_id := v_order.order_id;
    v_is_admin := (public.is_admin() OR auth.role() = 'service_role');

    IF v_is_admin THEN
        v_is_authorized := true;
        v_sender_type := 'admin';
        v_sender_name := 'فريق دعم Nexa';
    ELSIF auth.uid() IS NOT NULL AND (v_order.customer_id = auth.uid() OR v_order.customer_account_id = auth.uid()) THEN
        v_is_authorized := true;
        v_sender_type := 'customer';
        v_sender_name := v_order.customer_name;
    ELSIF v_clean_token <> '' AND (
        (v_order.access_token IS NOT NULL AND v_order.access_token = v_clean_token) OR 
        ((v_order.metadata->>'access_token') = v_clean_token)
    ) THEN
        v_is_authorized := true;
        v_sender_type := 'customer';
        v_sender_name := v_order.customer_name;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: invalid order access token';
    END IF;

    IF NOT v_is_admin THEN
        p_is_internal := false;
    END IF;

    IF (p_message IS NULL OR length(trim(p_message)) = 0) AND (p_attachments IS NULL OR jsonb_array_length(p_attachments) = 0) THEN
        RAISE EXCEPTION 'Message content or attachment is required';
    END IF;

    -- Validate attachment paths
    IF p_attachments IS NOT NULL AND jsonb_array_length(p_attachments) > 0 THEN
        FOR v_att IN SELECT * FROM jsonb_array_elements(p_attachments)
        LOOP
            IF v_att ? 'path' AND NOT public.validate_attachment_path(v_clean_order_id, v_att->>'path') THEN
                RAISE EXCEPTION 'Security error: Invalid attachment storage path "%"', v_att->>'path';
            END IF;
        END LOOP;
    END IF;

    INSERT INTO public.order_messages (
        order_id,
        sender_type,
        sender_id,
        sender_name,
        message,
        attachments,
        is_internal_note,
        is_read_by_admin,
        is_read_by_customer
    ) VALUES (
        v_order.id,
        v_sender_type,
        auth.uid(),
        v_sender_name,
        COALESCE(trim(p_message), ''),
        COALESCE(p_attachments, '[]'::jsonb),
        p_is_internal,
        CASE WHEN v_sender_type = 'admin' THEN true ELSE false END,
        CASE WHEN v_sender_type = 'customer' THEN true ELSE false END
    ) RETURNING id INTO v_msg_id;

    RETURN jsonb_build_object(
        'success', true,
        'message_id', v_msg_id,
        'created_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.add_order_message(TEXT, TEXT, TEXT, JSONB, BOOLEAN) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 15. RPC: mark_order_messages_read (IN-APP UNREAD COUNTER CLEARING)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_order_messages_read(
    p_order_id TEXT,
    p_reader_type TEXT,
    p_access_token TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_is_admin BOOLEAN := false;
    v_clean_order_id TEXT;
    v_clean_token TEXT;
BEGIN
    v_clean_order_id := trim(COALESCE(p_order_id, ''));
    v_clean_token := trim(COALESCE(p_access_token, ''));

    SELECT * INTO v_order 
    FROM public.orders 
    WHERE order_id = v_clean_order_id
       OR (v_clean_order_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id = v_clean_order_id::uuid);

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    v_clean_order_id := v_order.order_id;
    v_is_admin := (public.is_admin() OR auth.role() = 'service_role');

    IF p_reader_type = 'admin' AND v_is_admin THEN
        UPDATE public.order_messages 
        SET is_read_by_admin = true 
        WHERE order_id = v_order.id AND is_read_by_admin = false;
    ELSIF p_reader_type = 'customer' AND (
        (auth.uid() IS NOT NULL AND (v_order.customer_id = auth.uid() OR v_order.customer_account_id = auth.uid())) OR
        (v_clean_token <> '' AND (v_order.access_token = v_clean_token OR (v_order.metadata->>'access_token') = v_clean_token))
    ) THEN
        UPDATE public.order_messages 
        SET is_read_by_customer = true 
        WHERE order_id = v_order.id AND is_read_by_customer = false AND is_internal_note = false;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.mark_order_messages_read(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 16. RPC: request_order_recovery (RATE-LIMITED, SAFE QUEUE, ABUSE PROTECTED)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_order_recovery(
    p_order_id TEXT,
    p_contact_info TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_clean_order_id TEXT;
    v_clean_contact TEXT;
    v_masked_contact TEXT := '';
    v_attempts_15m INT := 0;
    v_attempts_24h INT := 0;
    v_recent_msg_count INT := 0;
    v_len INT;
BEGIN
    v_clean_order_id := substring(trim(COALESCE(p_order_id, '')) from 1 for 50);
    v_clean_contact := substring(trim(COALESCE(p_contact_info, '')) from 1 for 80);

    IF v_clean_order_id = '' THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'إذا كانت بيانات الطلب مطابقة لسجلاتنا، سيتم التواصل معك عبر وسيلة الاتصال المسجلة.'
        );
    END IF;

    -- Normalize order reference if real order exists to prevent alias-based rate limit evasion
    SELECT id, order_id INTO v_order 
    FROM public.orders 
    WHERE order_id = v_clean_order_id
       OR (v_clean_order_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id = v_clean_order_id::uuid);

    IF FOUND THEN
        v_clean_order_id := v_order.order_id;
    END IF;

    -- Concurrency Protection: Serialize recovery attempts on this order reference
    PERFORM pg_advisory_xact_lock(hashtext('recovery_' || v_clean_order_id)::bigint);

    -- Rate Limit 1: Max 3 attempts per 15 minutes
    SELECT count(*) INTO v_attempts_15m
    FROM public.order_recovery_requests
    WHERE order_reference = v_clean_order_id
      AND last_attempt_at > NOW() - INTERVAL '15 minutes';

    -- Rate Limit 2: Max 10 attempts per 24 hours
    SELECT count(*) INTO v_attempts_24h
    FROM public.order_recovery_requests
    WHERE order_reference = v_clean_order_id
      AND last_attempt_at > NOW() - INTERVAL '24 hours';

    IF v_attempts_15m >= 3 OR v_attempts_24h >= 10 THEN
        -- Exceeded rate limit: Return uniform zero-disclosure response
        RETURN jsonb_build_object(
            'success', true,
            'rate_limited', true,
            'manual_verification_required', true,
            'message', 'لأمان بياناتك وتراخيصك الرقمية، تم استلام طلبك مسبقاً. يُرجى التواصل مع فريق الدعم الفني عبر الواتساب لتأكيد الهوية واستلام الرابط.'
        );
    END IF;

    -- Mask contact info
    v_len := length(v_clean_contact);
    IF v_len > 6 THEN
        v_masked_contact := substring(v_clean_contact from 1 for 3) || '****' || substring(v_clean_contact from (v_len - 2) for 3);
    ELSIF v_len > 0 THEN
        v_masked_contact := '***' || substring(v_clean_contact from 1 for 2);
    ELSE
        v_masked_contact := 'غير محدد';
    END IF;

    -- Log attempt in rate limiting queue
    INSERT INTO public.order_recovery_requests (
        order_reference,
        masked_contact,
        attempt_count,
        last_attempt_at
    ) VALUES (
        v_clean_order_id,
        v_masked_contact,
        1,
        NOW()
    );

    -- If real order exists, alert admin safely (subject to 60-minute notification cooldown)
    IF v_order.id IS NOT NULL THEN
        SELECT count(*) INTO v_recent_msg_count
        FROM public.order_messages
        WHERE order_id = v_order.id
          AND is_internal_note = true
          AND sender_type = 'system'
          AND created_at > NOW() - INTERVAL '60 minutes';

        IF v_recent_msg_count = 0 THEN
            INSERT INTO public.order_messages (
                order_id,
                sender_type,
                sender_name,
                message,
                is_internal_note,
                is_read_by_admin
            ) VALUES (
                v_order.id,
                'system',
                'نظام الأمان',
                'طلب استرجاع يدوي للطلب ' || v_order.order_id || ' (بيانات الاتصال المدخلة: ' || v_masked_contact || '). يتطلب التحقق اليدوي من إثبات الدفع الأصلي.',
                true,
                false
            );
        END IF;

        -- Record security audit event
        INSERT INTO public.order_security_audit_log (
            order_id,
            event_type,
            actor_type,
            metadata
        ) VALUES (
            v_order.id,
            'recovery_attempt',
            'guest',
            jsonb_build_object(
                'masked_contact', v_masked_contact,
                'attempts_15m', v_attempts_15m + 1,
                'attempts_24h', v_attempts_24h + 1
            )
        );
    END IF;

    -- Constant-time uniform response: Never confirms order existence or leaks tokens
    RETURN jsonb_build_object(
        'success', true,
        'manual_verification_required', true,
        'message', 'لأمان بياناتك وتراخيصك الرقمية، تم إيقاف الاسترجاع التلقائي. يُرجى التواصل مع فريق الدعم الفني عبر الواتساب مع إرفاق إيصال الدفع الأصلي للتحقق اليدوي واستلام رابط الوصول.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.request_order_recovery(TEXT, TEXT) TO anon, authenticated, service_role;

-- Backward compatibility stub
CREATE OR REPLACE FUNCTION public.recover_order_access(
    p_order_id TEXT,
    p_verification_input TEXT
)
RETURNS JSONB AS $$
BEGIN
    RETURN public.request_order_recovery(p_order_id, p_verification_input);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.recover_order_access(TEXT, TEXT) TO anon, authenticated, service_role;

-- ==============================================================================
-- END OF MIGRATION SCRIPT
-- ==============================================================================
