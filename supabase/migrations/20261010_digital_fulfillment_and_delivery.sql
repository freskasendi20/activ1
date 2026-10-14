-- ==============================================================================
-- NEXA STORE — DIGITAL ORDER FULFILLMENT & DELIVERY SYSTEM MIGRATION
-- Migration Date: 2026-10-10
-- Target Project: mrinxsiostnzzjowutav
-- Status: PREPARED & ADDITIVE (PENDING USER APPROVAL — DO NOT RUN AUTOMATICALLY)
-- ==============================================================================
-- Summary of Additions:
-- 1. Adds delivery_preference, fulfillment_status, fulfillment_data, and access_token to public.orders.
-- 2. Adds delivery_config to public.products (templates, instructions, prep time, warranty).
-- 3. Creates public.order_fulfillments table for audit trail and per-item digital delivery payloads.
-- 4. Updates public.create_order_securely to accept delivery_preference and generate a secure access_token.
-- 5. Updates public.lookup_order(p_order_id, p_access_token) with cryptographic token authorization
--    to prevent unauthorized retrieval of private license keys and credentials.
-- 6. Enforces RLS on order_fulfillments so only admins can create/update, and customers can only
--    view fulfilled items belonging to their validated order token or account.
-- ==============================================================================

-- 1. EXTEND PUBLIC.ORDERS WITH DIGITAL DELIVERY COLUMNS (ADDITIVE & SAFE)
DO $$ BEGIN
    ALTER TABLE public.orders 
    ADD COLUMN IF NOT EXISTS delivery_preference TEXT DEFAULT 'website' 
    CHECK (delivery_preference IN ('website', 'email', 'whatsapp'));
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE public.orders 
    ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'pending' 
    CHECK (fulfillment_status IN ('pending', 'processing', 'fulfilled', 'cancelled'));
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE public.orders 
    ADD COLUMN IF NOT EXISTS fulfillment_data JSONB DEFAULT '{}'::jsonb;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE public.orders 
    ADD COLUMN IF NOT EXISTS access_token TEXT DEFAULT encode(gen_random_bytes(16), 'hex');
EXCEPTION WHEN duplicate_column THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON public.orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_access_token ON public.orders(access_token);

-- ------------------------------------------------------------------------------
-- 2. EXTEND PUBLIC.PRODUCTS WITH FULFILLMENT CONFIGURATION
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE public.products 
    ADD COLUMN IF NOT EXISTS delivery_config JSONB DEFAULT '{
        "delivery_type": "instant",
        "activation_type": "link",
        "expected_prep_time": "15 دقيقة",
        "warranty": "ضمان كامل المدة",
        "public_guide": "",
        "default_template": ""
    }'::jsonb;
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 3. TABLE: public.order_fulfillments (PER-ITEM / MULTI-PAYLOAD AUDIT TRAIL)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_fulfillments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    fulfillment_type TEXT NOT NULL DEFAULT 'link' CHECK (fulfillment_type IN ('link', 'license', 'account', 'manual')),
    activation_title TEXT,
    activation_url TEXT,
    license_key TEXT,
    account_username TEXT,
    account_password TEXT,
    instructions TEXT,
    customer_message TEXT,
    delivery_channel TEXT DEFAULT 'website' CHECK (delivery_channel IN ('website', 'email', 'whatsapp')),
    delivered_at TIMESTAMPTZ,
    delivered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'delivered', 'revoked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_fulfillments_order_id ON public.order_fulfillments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_fulfillments_status ON public.order_fulfillments(status);

-- ------------------------------------------------------------------------------
-- 4. RLS POLICIES FOR ORDER FULFILLMENTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.order_fulfillments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    -- Admins have unrestricted access to read, insert, update fulfillments
    CREATE POLICY "Admin full access on order_fulfillments" 
    ON public.order_fulfillments FOR ALL 
    USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    -- Authenticated customers can only view fulfilled items for their own orders
    CREATE POLICY "Customers view own delivered fulfillments" 
    ON public.order_fulfillments FOR SELECT 
    USING (
        status = 'delivered' AND EXISTS (
            SELECT 1 FROM public.orders o 
            WHERE o.id = order_fulfillments.order_id 
              AND (o.customer_id = auth.uid() AND auth.uid() IS NOT NULL)
        )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 5. SECURE ORDER CREATION RPC (UPDATED WITH DELIVERY PREFERENCE & ACCESS TOKEN)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_securely(
    p_order_id TEXT,
    p_customer_name TEXT,
    p_customer_email TEXT,
    p_customer_phone TEXT,
    p_payment_method TEXT,
    p_items JSONB,
    p_notes TEXT DEFAULT NULL,
    p_coupon_code TEXT DEFAULT NULL,
    p_transfer_number TEXT DEFAULT NULL,
    p_receipt_image_url TEXT DEFAULT NULL,
    p_delivery_preference TEXT DEFAULT 'website',
    p_access_token TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order_uuid UUID;
    v_subtotal NUMERIC(10, 2) := 0;
    v_global_discount_pct NUMERIC(5, 2) := 0;
    v_standard_discount NUMERIC(10, 2) := 0;
    v_coupon_discount NUMERIC(10, 2) := 0;
    v_total_egp NUMERIC(10, 2) := 0;
    v_total_usd NUMERIC(10, 2) := 0;
    v_usd_rate NUMERIC(10, 4) := 50.0;
    v_coupon_rec RECORD;
    v_item JSONB;
    v_prod_id TEXT;
    v_qty INT;
    v_product RECORD;
    v_delivery_type TEXT;
    v_token TEXT;
BEGIN
    -- 1. Input Sanity Checks
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item';
    END IF;

    IF p_customer_name IS NULL OR length(trim(p_customer_name)) < 2 THEN
        RAISE EXCEPTION 'Customer name is required';
    END IF;

    IF p_customer_phone IS NULL OR length(trim(p_customer_phone)) < 8 THEN
        RAISE EXCEPTION 'Valid phone number is required';
    END IF;

    -- Token generation or validation
    v_token := COALESCE(NULLIF(trim(p_access_token), ''), encode(gen_random_bytes(16), 'hex'));

    -- 2. Fetch Active Promo & USD Rate from store_settings
    SELECT COALESCE((value->>'rate')::numeric, 50.0) INTO v_usd_rate
    FROM public.store_settings WHERE key = 'usd_rate';

    SELECT COALESCE((value->>'discount')::numeric, 0.0) INTO v_global_discount_pct
    FROM public.store_settings WHERE key = 'global_promo';

    -- 3. Calculate True Subtotal from Server Database (Anti-Tamper)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_prod_id := v_item->>'id';
        v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));

        SELECT id, name, price_egp, is_active INTO v_product
        FROM public.products
        WHERE id = v_prod_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % not found in catalog', v_prod_id;
        END IF;

        IF NOT v_product.is_active THEN
            RAISE EXCEPTION 'Product % is currently out of stock or inactive', v_product.name;
        END IF;

        v_subtotal := v_subtotal + (v_product.price_egp * v_qty);
    END LOOP;

    -- 4. Calculate Standard Discounts
    IF v_global_discount_pct > 0 THEN
        v_standard_discount := ROUND((v_subtotal * (v_global_discount_pct / 100.0)), 2);
    END IF;

    -- 5. Calculate Coupon Discount if provided
    IF p_coupon_code IS NOT NULL AND length(trim(p_coupon_code)) > 0 THEN
        SELECT * INTO v_coupon_rec
        FROM public.coupons
        WHERE UPPER(code) = UPPER(trim(p_coupon_code))
          AND is_active = true
          AND (min_spend IS NULL OR v_subtotal >= min_spend);

        IF FOUND THEN
            IF v_coupon_rec.discount_type = 'percentage' THEN
                v_coupon_discount := ROUND((v_subtotal * (v_coupon_rec.discount_value / 100.0)), 2);
            ELSE
                v_coupon_discount := LEAST(v_subtotal, v_coupon_rec.discount_value);
            END IF;
        END IF;
    END IF;

    -- 6. Final Authoritative Totals
    v_total_egp := GREATEST(0, v_subtotal - v_standard_discount - v_coupon_discount);
    IF v_usd_rate > 0 THEN
        v_total_usd := ROUND((v_total_egp / v_usd_rate), 2);
    END IF;

    -- 7. Insert Order Row
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
        delivery_preference,
        access_token,
        status,
        fulfillment_status,
        metadata
    ) VALUES (
        p_order_id,
        auth.uid(),
        trim(p_customer_name),
        trim(p_customer_email),
        trim(p_customer_phone),
        p_notes,
        v_subtotal,
        v_standard_discount + v_coupon_discount,
        v_total_egp,
        v_total_usd,
        p_payment_method,
        p_transfer_number,
        p_receipt_image_url,
        COALESCE(p_delivery_preference, 'website'),
        v_token,
        'pending',
        'pending',
        jsonb_build_object(
            'global_promo_pct', v_global_discount_pct,
            'coupon_code', p_coupon_code,
            'delivery_preference', COALESCE(p_delivery_preference, 'website'),
            'access_token', v_token
        )
    ) RETURNING id INTO v_order_uuid;

    -- 8. Insert Order Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_prod_id := v_item->>'id';
        v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));

        SELECT id, name, duration, price_egp, image INTO v_product
        FROM public.products
        WHERE id = v_prod_id;

        v_delivery_type := COALESCE(v_item->>'deliveryType', 'اشتراك رقمي معتمد');

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

    -- 9. Return Result
    RETURN jsonb_build_object(
        'success', true,
        'order_uuid', v_order_uuid,
        'order_id', p_order_id,
        'access_token', v_token,
        'subtotal_egp', v_subtotal,
        'discount_egp', v_standard_discount + v_coupon_discount,
        'total_egp', v_total_egp,
        'total_usd', v_total_usd,
        'delivery_preference', COALESCE(p_delivery_preference, 'website')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 6. SECURE ORDER LOOKUP RPC (TOKEN-AWARE WITH CONDITIONAL FULFILLMENT SECRETS)
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
    v_is_authorized BOOLEAN := false;
BEGIN
    SELECT * INTO v_order 
    FROM public.orders 
    WHERE order_id = p_order_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Authorization check: Admin, Authenticated Owner, or Matching Access Token
    IF public.is_admin() OR auth.role() = 'service_role' THEN
        v_is_authorized := true;
    ELSIF auth.uid() IS NOT NULL AND v_order.customer_id = auth.uid() THEN
        v_is_authorized := true;
    ELSIF p_access_token IS NOT NULL AND (
        v_order.access_token = p_access_token OR 
        (v_order.metadata->>'access_token') = p_access_token
    ) THEN
        v_is_authorized := true;
    END IF;

    -- Aggregate Items
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

    -- Aggregate Fulfillments if authorized
    IF v_is_authorized THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', id,
            'productName', product_name,
            'fulfillmentType', fulfillment_type,
            'activationTitle', activation_title,
            'activationUrl', activation_url,
            'licenseKey', license_key,
            'accountUsername', account_username,
            'accountPassword', account_password,
            'instructions', instructions,
            'customerMessage', customer_message,
            'deliveryChannel', delivery_channel,
            'deliveredAt', delivered_at,
            'status', status
        )), '[]'::jsonb) INTO v_fulfillments
        FROM public.order_fulfillments
        WHERE order_id = v_order.id
          AND (status = 'delivered' OR public.is_admin());
    END IF;

    -- Return Order Object (Mask sensitive delivery secrets if unauthorized)
    RETURN jsonb_build_object(
        'orderId', v_order.order_id,
        'createdAt', v_order.created_at,
        'customerName', CASE WHEN v_is_authorized THEN v_order.customer_name ELSE substring(v_order.customer_name from 1 for 3) || '***' END,
        'customerEmail', CASE WHEN v_is_authorized THEN v_order.customer_email ELSE '***@***.***' END,
        'customerPhone', CASE WHEN v_is_authorized THEN v_order.customer_phone ELSE '***' END,
        'notes', CASE WHEN v_is_authorized THEN v_order.notes ELSE NULL END,
        'subtotalEgp', v_order.subtotal_egp,
        'discountEgp', v_order.discount_egp,
        'totalEgp', v_order.total_egp,
        'totalUsd', v_order.total_usd,
        'paymentMethod', v_order.payment_method,
        'transferNumber', CASE WHEN v_is_authorized THEN v_order.transfer_number ELSE NULL END,
        'receiptImage', CASE WHEN v_is_authorized THEN v_order.receipt_image_url ELSE NULL END,
        'status', v_order.status,
        'fulfillmentStatus', COALESCE(v_order.fulfillment_status, 'pending'),
        'deliveryPreference', COALESCE(v_order.delivery_preference, v_order.metadata->>'delivery_preference', 'website'),
        'items', COALESCE(v_items, '[]'::jsonb),
        'fulfillments', v_fulfillments,
        'fulfillmentData', CASE WHEN v_is_authorized THEN COALESCE(v_order.fulfillment_data, v_order.metadata->'fulfillment_payload', NULL) ELSE NULL END,
        'isAuthorized', v_is_authorized
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
