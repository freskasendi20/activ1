-- ==============================================================================
-- NEXA STORE — VERIFIED CUSTOMER ACCOUNTS, ORDER PORTAL & NEXA COINS SYSTEM
-- File: supabase/migrations/20261011_nexa_coins_and_customer_accounts.sql
-- Status: PREPARED FOR USER REVIEW & APPROVAL (DO NOT RUN WITHOUT USER APPROVAL)
-- ==============================================================================
-- ARCHITECTURE & SECURITY GUARANTEES:
-- 1. CANONICAL CUSTOMER IDENTITY:
--    - Bound strictly to auth.users UUID (Supabase Auth).
--    - Zero automatic claiming of orders based on unverified email/phone matches.
--    - Verified guest order claiming strictly requires BOTH order_id AND positive access_token match.
-- 2. SERVER-AUTHORITATIVE NEXA COINS LOYALTY SYSTEM:
--    - Loyalty currency is store reward only (not crypto/cash).
--    - Double-spend protection via SELECT ... FOR UPDATE row-level locking.
--    - Full transactional ledger (public.loyalty_transactions) recording every credit/debit.
--    - Earning rewards requires payment_status = 'verified' AND fulfillment_status = 'fulfilled'.
--    - Reward calculations originate strictly from server functions (public.loyalty_rules).
--    - Redemptions support up to configurable max discount percentage (default 50%).
--    - 100% coin coverage permitted when allowed by rules, skipping external payment gateways safely.
--    - Automatic reward reversal or release on order cancellation or rejection with accurate deficit accounting.
--    - Admin promotional adjustments strictly require reason and are recorded in public.loyalty_audit_log.
-- 3. SYNTHETIC TOKEN INVALIDATION:
--    - Revokes exposed synthetic test order access token for NEXA-SYNTH-27754.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. PREREQUISITES & EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Security Revocation: Invalidate Exposed Test Token
UPDATE public.orders 
SET access_token = 'REVOKED_TEST_' || encode(gen_random_bytes(16), 'hex'),
    metadata = COALESCE(metadata, '{}'::jsonb) - 'access_token'
WHERE order_id = 'NEXA-SYNTH-27754';

-- ------------------------------------------------------------------------------
-- 1. ORDERS TABLE EXTENSIONS (Customer Account & Loyalty Fields)
-- ------------------------------------------------------------------------------
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_account_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS coins_earned INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS coins_redeemed INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS coins_discount_egp NUMERIC(10, 2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_customer_account_id ON public.orders(customer_account_id);

-- ------------------------------------------------------------------------------
-- 2. TABLE: loyalty_rules (Admin-Configurable Rewards Policy with Strict Validation)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_rules (
    id TEXT PRIMARY KEY DEFAULT 'default',
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    earn_rate_ratio NUMERIC(10, 4) NOT NULL DEFAULT 0.1000 CHECK (earn_rate_ratio > 0 AND earn_rate_ratio <= 1.0000), -- 1 Coin per 10 EGP paid in cash/real money (10%)
    redeem_rate_egp NUMERIC(10, 4) NOT NULL DEFAULT 0.5000 CHECK (redeem_rate_egp > 0 AND redeem_rate_egp <= 100.0000), -- 1 Coin = 0.50 EGP discount
    min_redeem_coins INT NOT NULL DEFAULT 10 CHECK (min_redeem_coins >= 1),                                              -- Min 10 Coins required to redeem
    max_discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 50.00 CHECK (max_discount_percentage > 0 AND max_discount_percentage <= 100.00), -- Max 50% discount from coins
    allow_full_coin_payment BOOLEAN NOT NULL DEFAULT true,  -- If coins cover 100% of subtotal, allow full checkout
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Ensure constraints exist if table already existed prior to migration
DO $$ BEGIN
    ALTER TABLE public.loyalty_rules 
    ADD CONSTRAINT chk_loyalty_earn_rate CHECK (earn_rate_ratio > 0 AND earn_rate_ratio <= 1.0000);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE public.loyalty_rules 
    ADD CONSTRAINT chk_loyalty_redeem_rate CHECK (redeem_rate_egp > 0 AND redeem_rate_egp <= 100.0000);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE public.loyalty_rules 
    ADD CONSTRAINT chk_loyalty_min_redeem CHECK (min_redeem_coins >= 1);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE public.loyalty_rules 
    ADD CONSTRAINT chk_loyalty_max_discount CHECK (max_discount_percentage > 0 AND max_discount_percentage <= 100.00);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Seed default loyalty rules if empty
INSERT INTO public.loyalty_rules (id, is_enabled, earn_rate_ratio, redeem_rate_egp, min_redeem_coins, max_discount_percentage, allow_full_coin_payment)
VALUES ('default', true, 0.1000, 0.5000, 10, 50.00, true)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. TABLE: loyalty_wallets (Customer Loyalty Balances)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    available_balance INT NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
    pending_balance INT NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
    reserved_balance INT NOT NULL DEFAULT 0 CHECK (reserved_balance >= 0),
    pending_deficit INT NOT NULL DEFAULT 0 CHECK (pending_deficit >= 0),
    lifetime_earned INT NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
    lifetime_redeemed INT NOT NULL DEFAULT 0 CHECK (lifetime_redeemed >= 0),
    is_frozen BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_wallets_user ON public.loyalty_wallets(user_id);

-- ------------------------------------------------------------------------------
-- 4. TABLE: loyalty_transactions (Immutable Auditable Transaction Ledger)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES public.loyalty_wallets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    order_reference TEXT,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'purchase_reward',
        'redemption_deduction',
        'reservation_hold',
        'reservation_release',
        'refund_reversal',
        'admin_adjustment',
        'promotional_bonus'
    )),
    amount INT NOT NULL, -- positive for credits, negative for debits
    balance_after INT NOT NULL CHECK (balance_after >= 0),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled', 'reversed')),
    description TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_wallet ON public.loyalty_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_user ON public.loyalty_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_order ON public.loyalty_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_created ON public.loyalty_transactions(created_at DESC);

-- Ensure loyalty_wallets non-negative balance constraints exist
DO $$ BEGIN
    ALTER TABLE public.loyalty_wallets 
    ADD COLUMN IF NOT EXISTS pending_deficit INT NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE public.loyalty_wallets 
    ADD CONSTRAINT chk_loyalty_wallet_available CHECK (available_balance >= 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE public.loyalty_wallets 
    ADD CONSTRAINT chk_loyalty_wallet_deficit CHECK (pending_deficit >= 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE public.loyalty_wallets 
    ADD CONSTRAINT chk_loyalty_wallet_lifetime_earned CHECK (lifetime_earned >= 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE public.loyalty_wallets 
    ADD CONSTRAINT chk_loyalty_wallet_lifetime_redeemed CHECK (lifetime_redeemed >= 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Ensure loyalty_transactions cannot have orphaned redemption or purchase reward without order_id
DO $$ BEGIN
    ALTER TABLE public.loyalty_transactions 
    ADD CONSTRAINT chk_loyalty_tx_order_required 
    CHECK (
        (transaction_type IN ('redemption_deduction', 'purchase_reward') AND order_id IS NOT NULL)
        OR (transaction_type NOT IN ('redemption_deduction', 'purchase_reward'))
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 5. TABLE: loyalty_audit_log (Admin Adjustments & Policy Modifications)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_audit_target ON public.loyalty_audit_log(target_user_id);

-- ------------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES & PRIVILEGE ESCALATION PREVENTION
-- ------------------------------------------------------------------------------
ALTER TABLE public.loyalty_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_audit_log ENABLE ROW LEVEL SECURITY;

-- loyalty_rules: All users can view; only admins can edit
DO $$ BEGIN
    DROP POLICY IF EXISTS "Anyone can view loyalty rules" ON public.loyalty_rules;
    CREATE POLICY "Anyone can view loyalty rules"
    ON public.loyalty_rules FOR SELECT
    USING (true);
EXCEPTION WHEN undefined_object THEN null; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Admins full control on loyalty rules" ON public.loyalty_rules;
    CREATE POLICY "Admins full control on loyalty rules"
    ON public.loyalty_rules FOR ALL
    USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN undefined_object THEN null; END $$;

-- loyalty_wallets: Users view own wallet; Admins view all
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users view own loyalty wallet" ON public.loyalty_wallets;
    CREATE POLICY "Users view own loyalty wallet"
    ON public.loyalty_wallets FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN undefined_object THEN null; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Admins manage all loyalty wallets" ON public.loyalty_wallets;
    CREATE POLICY "Admins manage all loyalty wallets"
    ON public.loyalty_wallets FOR ALL
    USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN undefined_object THEN null; END $$;

-- loyalty_transactions: Users view own ledger; Admins view all
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users view own loyalty transactions" ON public.loyalty_transactions;
    CREATE POLICY "Users view own loyalty transactions"
    ON public.loyalty_transactions FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN undefined_object THEN null; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Admins manage all loyalty transactions" ON public.loyalty_transactions;
    CREATE POLICY "Admins manage all loyalty transactions"
    ON public.loyalty_transactions FOR ALL
    USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN undefined_object THEN null; END $$;

-- loyalty_audit_log: Only admins
DO $$ BEGIN
    DROP POLICY IF EXISTS "Admins view loyalty audit log" ON public.loyalty_audit_log;
    CREATE POLICY "Admins view loyalty audit log"
    ON public.loyalty_audit_log FOR SELECT
    USING (public.is_admin() OR auth.role() = 'service_role');
EXCEPTION WHEN undefined_object THEN null; END $$;

-- Orders Table RLS: Authenticated users can query their own linked orders
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can query own linked orders" ON public.orders;
    CREATE POLICY "Users can query own linked orders"
    ON public.orders FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND 
        (customer_id = auth.uid() OR customer_account_id = auth.uid())
    );
EXCEPTION WHEN undefined_object THEN null; END $$;

-- Order Items Table RLS: Authenticated users can read items of their linked orders
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users view own order items via customer_account_id" ON public.order_items;
    CREATE POLICY "Users view own order items via customer_account_id"
    ON public.order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o 
            WHERE o.id = order_items.order_id 
              AND (o.customer_id = auth.uid() OR o.customer_account_id = auth.uid())
        )
    );
EXCEPTION WHEN undefined_object THEN null; END $$;

-- Profiles Role Escalation Protection: Rigorous Trigger for BOTH INSERT AND UPDATE
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
    -- On INSERT: Non-admins cannot insert role other than 'customer'
    IF TG_OP = 'INSERT' THEN
        IF NEW.role IS NOT NULL AND NEW.role <> 'customer'::user_role THEN
            IF NOT (auth.role() = 'service_role' OR public.is_admin()) THEN
                NEW.role := 'customer'::user_role;
            END IF;
        ELSE
            NEW.role := COALESCE(NEW.role, 'customer'::user_role);
        END IF;
    END IF;

    -- On UPDATE: Non-admins cannot alter their role
    IF TG_OP = 'UPDATE' THEN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            IF NOT (auth.role() = 'service_role' OR public.is_admin()) THEN
                RAISE EXCEPTION 'Privilege escalation rejected: only administrators can alter user roles.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_role();

-- Profiles Table RLS: Strictly scoped to prevent role escalation on INSERT/UPDATE
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
    CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (
        (auth.uid() = id AND (role IS NULL OR role = 'customer'::user_role))
        OR public.is_admin() 
        OR auth.role() = 'service_role'
    );
EXCEPTION WHEN undefined_object THEN null; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id OR public.is_admin() OR auth.role() = 'service_role')
    WITH CHECK (
        (auth.uid() = id AND role = 'customer'::user_role)
        OR public.is_admin() 
        OR auth.role() = 'service_role'
    );
EXCEPTION WHEN undefined_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 7. RPC: get_or_create_customer_wallet (Atomic Wallet Resolver)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_customer_wallet(p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_target_user UUID;
    v_wallet RECORD;
BEGIN
    v_target_user := COALESCE(p_user_id, auth.uid());
    IF v_target_user IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    -- Security: non-admins cannot inspect other users' wallets
    IF v_target_user <> auth.uid() AND NOT (public.is_admin() OR auth.role() = 'service_role') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Upsert wallet
    INSERT INTO public.loyalty_wallets (user_id)
    VALUES (v_target_user)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_wallet FROM public.loyalty_wallets WHERE user_id = v_target_user;

    RETURN jsonb_build_object(
        'success', true,
        'wallet_id', v_wallet.id,
        'user_id', v_wallet.user_id,
        'available_balance', v_wallet.available_balance,
        'pending_balance', v_wallet.pending_balance,
        'reserved_balance', v_wallet.reserved_balance,
        'pending_deficit', COALESCE(v_wallet.pending_deficit, 0),
        'lifetime_earned', v_wallet.lifetime_earned,
        'lifetime_redeemed', v_wallet.lifetime_redeemed,
        'is_frozen', v_wallet.is_frozen
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 8. RPC: calculate_order_coins_redemption (Server-Side Rate & Limit Engine)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_order_coins_redemption(
    p_subtotal_egp NUMERIC,
    p_coins_requested INT DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_rules RECORD;
    v_wallet RECORD;
    v_user UUID;
    v_available_coins INT := 0;
    v_max_coins_by_discount INT;
    v_max_discount_egp NUMERIC(10, 2);
    v_coins_to_use INT;
    v_discount_egp NUMERIC(10, 2);
    v_final_payable NUMERIC(10, 2);
BEGIN
    SELECT * INTO v_rules FROM public.loyalty_rules WHERE id = 'default';
    IF NOT FOUND OR NOT v_rules.is_enabled OR COALESCE(v_rules.redeem_rate_egp, 0) <= 0 THEN
        RETURN jsonb_build_object(
            'is_enabled', false,
            'coins_available', 0,
            'coins_to_use', 0,
            'discount_egp', 0.00,
            'final_payable', GREATEST(0.00, COALESCE(p_subtotal_egp, 0))
        );
    END IF;

    IF p_subtotal_egp IS NULL OR p_subtotal_egp <= 0 THEN
        RETURN jsonb_build_object(
            'is_enabled', true,
            'coins_available', 0,
            'coins_to_use', 0,
            'discount_egp', 0.00,
            'final_payable', 0.00
        );
    END IF;

    v_user := auth.uid();
    IF v_user IS NOT NULL THEN
        SELECT * INTO v_wallet FROM public.loyalty_wallets WHERE user_id = v_user;
        IF FOUND AND NOT v_wallet.is_frozen THEN
            v_available_coins := v_wallet.available_balance;
        END IF;
    END IF;

    -- Maximum discount allowed by policy percentage
    v_max_discount_egp := ROUND((p_subtotal_egp * (v_rules.max_discount_percentage / 100.0)), 2);
    v_max_coins_by_discount := FLOOR(v_max_discount_egp / v_rules.redeem_rate_egp);

    -- If full coin payment is allowed and user has enough balance to cover 100% of order
    IF v_rules.allow_full_coin_payment AND (v_available_coins * v_rules.redeem_rate_egp) >= p_subtotal_egp THEN
        v_max_coins_by_discount := CEIL(p_subtotal_egp / v_rules.redeem_rate_egp);
        v_max_discount_egp := p_subtotal_egp;
    END IF;

    -- Determine applicable coins: positive, non-negative
    v_coins_to_use := LEAST(GREATEST(0, COALESCE(p_coins_requested, 0)), v_available_coins, v_max_coins_by_discount);
    
    -- Check minimum redemption threshold
    IF v_coins_to_use > 0 AND v_coins_to_use < v_rules.min_redeem_coins THEN
        v_coins_to_use := 0;
    END IF;

    v_discount_egp := ROUND(v_coins_to_use * v_rules.redeem_rate_egp, 2);
    v_final_payable := GREATEST(0.00, p_subtotal_egp - v_discount_egp);

    RETURN jsonb_build_object(
        'is_enabled', true,
        'earn_rate_ratio', v_rules.earn_rate_ratio,
        'redeem_rate_egp', v_rules.redeem_rate_egp,
        'min_redeem_coins', v_rules.min_redeem_coins,
        'max_discount_percentage', v_rules.max_discount_percentage,
        'max_eligible_coins', LEAST(v_available_coins, v_max_coins_by_discount),
        'coins_available', v_available_coins,
        'coins_to_use', v_coins_to_use,
        'discount_egp', v_discount_egp,
        'final_payable', v_final_payable,
        'coins_to_earn_on_completion', FLOOR(v_final_payable * v_rules.earn_rate_ratio)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 9. RPC: reserve_and_redeem_coins (Atomic Concurrency-Safe Ledger Debit)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_and_redeem_coins(
    p_order_id TEXT,
    p_coins_to_redeem INT,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user UUID;
    v_wallet RECORD;
    v_order RECORD;
    v_rules RECORD;
    v_settings_val JSONB;
    v_exchange_rate NUMERIC(10, 4);
    v_clean_order_id TEXT;
    v_scoped_idem_key TEXT;
    v_max_discount_egp NUMERIC(10, 2);
    v_max_coins_by_discount INT;
    v_coins_to_use INT;
    v_discount_egp NUMERIC(10, 2);
    v_new_payable NUMERIC(10, 2);
    v_new_usd NUMERIC(10, 2);
    v_existing_tx RECORD;
    v_new_balance INT;
BEGIN
    -- 1. Must be authenticated
    v_user := auth.uid();
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'Authentication required to redeem Nexa Coins.';
    END IF;

    v_clean_order_id := trim(COALESCE(p_order_id, ''));
    IF v_clean_order_id = '' THEN
        RAISE EXCEPTION 'Order ID is required to redeem coins.';
    END IF;

    IF p_coins_to_redeem IS NULL OR p_coins_to_redeem <= 0 THEN
        RETURN jsonb_build_object('success', true, 'coins_redeemed', 0);
    END IF;

    -- 2. Verify Order Existence & Strict Positive Customer Ownership (MUST RUN BEFORE IDEMPOTENCY)
    SELECT * INTO v_order 
    FROM public.orders 
    WHERE (order_id = v_clean_order_id OR UPPER(order_id) = UPPER(v_clean_order_id) OR id::text = v_clean_order_id) 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % does not exist. Redemption requires an existing valid order.', v_clean_order_id;
    END IF;

    -- Positive proof of ownership: customer_account_id or customer_id MUST match auth.uid()
    IF v_order.customer_account_id IS DISTINCT FROM v_user AND v_order.customer_id IS DISTINCT FROM v_user THEN
        RAISE EXCEPTION 'Unauthorized: Order % does not belong to your authenticated customer account.', v_clean_order_id;
    END IF;

    -- Reject completed, already fulfilled, cancelled, refunded, or rejected orders
    IF v_order.status IN ('completed', 'cancelled') 
       OR v_order.fulfillment_status IN ('fulfilled', 'cancelled') 
       OR v_order.payment_status IN ('verified', 'rejected', 'refunded') THEN
        RAISE EXCEPTION 'Cannot redeem coins on completed, fulfilled, verified, cancelled, or ineligible order %.', v_clean_order_id;
    END IF;

    -- Validate subtotal
    IF v_order.subtotal_egp IS NULL OR v_order.subtotal_egp <= 0 THEN
        RAISE EXCEPTION 'Order % is ineligible for coin redemption due to non-positive subtotal.', v_clean_order_id;
    END IF;

    -- Prevent double redemption on same order
    IF v_order.coins_redeemed > 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_redeemed', true,
            'order_id', v_clean_order_id,
            'coins_redeemed', v_order.coins_redeemed
        );
    END IF;

    -- 3. Scoped Idempotency Check (Scoped strictly to customer, order, transaction type, and amount)
    v_scoped_idem_key := 'redeem_' || v_clean_order_id || '_' || v_user::text || '_' || p_coins_to_redeem::text;
    IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
        v_scoped_idem_key := 'redeem_' || v_clean_order_id || '_' || v_user::text || '_' || trim(p_idempotency_key);
    END IF;

    SELECT * INTO v_existing_tx 
    FROM public.loyalty_transactions 
    WHERE user_id = v_user 
      AND (order_id = v_order.id OR order_reference = v_clean_order_id)
      AND transaction_type = 'redemption_deduction'
      AND (idempotency_key = v_scoped_idem_key OR amount = -p_coins_to_redeem);
    
    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent_duplicate', true,
            'order_id', v_clean_order_id,
            'coins_redeemed', ABS(v_existing_tx.amount),
            'balance_after', v_existing_tx.balance_after
        );
    END IF;

    -- 4. Concurrency Lock on Customer Wallet (FOR UPDATE)
    SELECT * INTO v_wallet FROM public.loyalty_wallets WHERE user_id = v_user FOR UPDATE;
    IF NOT FOUND THEN
        INSERT INTO public.loyalty_wallets (user_id) VALUES (v_user);
        SELECT * INTO v_wallet FROM public.loyalty_wallets WHERE user_id = v_user FOR UPDATE;
    END IF;

    IF v_wallet.is_frozen THEN
        RAISE EXCEPTION 'Customer wallet is currently frozen. Contact support.';
    END IF;

    IF v_wallet.available_balance < p_coins_to_redeem THEN
        RAISE EXCEPTION 'Insufficient Nexa Coins balance. Available: %, Requested: %', v_wallet.available_balance, p_coins_to_redeem;
    END IF;

    -- 5. Server-Authoritative Policy Validation & Calculation
    SELECT * INTO v_rules FROM public.loyalty_rules WHERE id = 'default';
    IF NOT FOUND OR NOT v_rules.is_enabled OR v_rules.redeem_rate_egp <= 0 THEN
        RAISE EXCEPTION 'Nexa Coins redemption is currently disabled or unconfigured.';
    END IF;

    v_max_discount_egp := ROUND((v_order.subtotal_egp * (v_rules.max_discount_percentage / 100.0)), 2);
    v_max_coins_by_discount := FLOOR(v_max_discount_egp / v_rules.redeem_rate_egp);

    IF v_rules.allow_full_coin_payment AND (v_wallet.available_balance * v_rules.redeem_rate_egp) >= v_order.subtotal_egp THEN
        v_max_coins_by_discount := CEIL(v_order.subtotal_egp / v_rules.redeem_rate_egp);
        v_max_discount_egp := v_order.subtotal_egp;
    END IF;

    v_coins_to_use := LEAST(p_coins_to_redeem, v_wallet.available_balance, v_max_coins_by_discount);

    IF v_coins_to_use < v_rules.min_redeem_coins THEN
        RAISE EXCEPTION 'Minimum redemption threshold is % coins.', v_rules.min_redeem_coins;
    END IF;

    v_discount_egp := ROUND(v_coins_to_use * v_rules.redeem_rate_egp, 2);
    v_new_payable := GREATEST(0.00, v_order.subtotal_egp - COALESCE(v_order.discount_egp, 0) - v_discount_egp);
    v_new_balance := v_wallet.available_balance - v_coins_to_use;

    -- Authoritative Exchange Rate Resolution (Uses existing store settings, never hardcoded 50)
    SELECT (value->>'usd_egp_rate')::NUMERIC INTO v_exchange_rate 
    FROM public.store_settings 
    WHERE key = 'currency_config' 
      AND (value->>'usd_egp_rate') IS NOT NULL 
      AND (value->>'usd_egp_rate')::NUMERIC > 0;

    IF v_exchange_rate IS NULL OR v_exchange_rate <= 0 THEN
        IF v_order.total_usd > 0 AND v_order.total_egp > 0 THEN
            v_exchange_rate := ROUND((v_order.total_egp / v_order.total_usd), 4);
        ELSIF v_order.total_usd > 0 AND v_order.subtotal_egp > 0 THEN
            v_exchange_rate := ROUND((v_order.subtotal_egp / v_order.total_usd), 4);
        ELSE
            v_exchange_rate := 1.0;
        END IF;
    END IF;

    v_new_usd := ROUND(v_new_payable / v_exchange_rate, 2);

    -- 6. Atomic Debit on Wallet
    UPDATE public.loyalty_wallets SET
        available_balance = v_new_balance,
        lifetime_redeemed = lifetime_redeemed + v_coins_to_use,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    -- 7. Ledger Insertion (Non-orphaned: strictly bound to order_id NOT NULL)
    INSERT INTO public.loyalty_transactions (
        wallet_id,
        user_id,
        order_id,
        order_reference,
        transaction_type,
        amount,
        balance_after,
        status,
        description,
        idempotency_key,
        created_by
    ) VALUES (
        v_wallet.id,
        v_user,
        v_order.id,
        v_clean_order_id,
        'redemption_deduction',
        -v_coins_to_use,
        v_new_balance,
        'completed',
        'خصم ' || v_coins_to_use || ' عملة Nexa Coins لتغطية خصم ' || v_discount_egp || ' ج.م من الطلب ' || v_clean_order_id,
        v_scoped_idem_key,
        v_user
    );

    -- 8. Update Order Totals
    UPDATE public.orders SET
        coins_redeemed = v_coins_to_use,
        coins_discount_egp = v_discount_egp,
        total_egp = v_new_payable,
        total_usd = v_new_usd,
        customer_account_id = v_user,
        customer_id = COALESCE(customer_id, v_user),
        payment_status = CASE WHEN v_new_payable = 0.00 THEN 'verified'::payment_status ELSE payment_status END,
        payment_method = CASE WHEN v_new_payable = 0.00 THEN 'Nexa Coins Wallet' ELSE payment_method END,
        transfer_number = CASE WHEN v_new_payable = 0.00 THEN 'تغطية 100% بالكوينز' ELSE transfer_number END
    WHERE id = v_order.id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_clean_order_id,
        'coins_redeemed', v_coins_to_use,
        'discount_egp', v_discount_egp,
        'final_payable', v_new_payable,
        'final_payable_usd', v_new_usd,
        'balance_after', v_new_balance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 10. INTERNAL & ADMIN RPC: award_order_coins (Deficit Recovery & Financial Security)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._internal_award_order_coins(p_order_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_rules RECORD;
    v_user UUID;
    v_wallet RECORD;
    v_coins_to_award INT;
    v_real_cash_paid NUMERIC(10, 2);
    v_idem_key TEXT;
    v_existing_tx RECORD;
    v_deficit_to_recover INT := 0;
    v_net_coins_credited INT := 0;
    v_remaining_deficit INT := 0;
    v_new_balance INT;
BEGIN
    SELECT * INTO v_rules FROM public.loyalty_rules WHERE id = 'default';
    IF NOT FOUND OR NOT v_rules.is_enabled OR v_rules.earn_rate_ratio <= 0 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Loyalty rewards currently disabled or unconfigured');
    END IF;

    SELECT * INTO v_order 
    FROM public.orders 
    WHERE (order_id = trim(p_order_id) OR UPPER(order_id) = UPPER(trim(p_order_id)) OR id::text = trim(p_order_id))
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Strict Prerequisites: Payment Verified AND Digital Fulfillment COMPLETED (fulfilled)
    IF v_order.payment_status <> 'verified' THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Payment must be verified to award coins');
    END IF;

    IF v_order.fulfillment_status <> 'fulfilled' THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Digital fulfillment must be completed (fulfilled) to award coins');
    END IF;

    IF v_order.status = 'cancelled' OR v_order.payment_status IN ('rejected', 'refunded') THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Cannot award coins on cancelled, rejected, or refunded order');
    END IF;

    v_user := COALESCE(v_order.customer_account_id, v_order.customer_id);
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Order not linked to verified customer account');
    END IF;

    v_idem_key := 'award_' || v_order.order_id;
    SELECT * INTO v_existing_tx FROM public.loyalty_transactions WHERE idempotency_key = v_idem_key;
    IF FOUND THEN
        RETURN jsonb_build_object('success', true, 'already_awarded', true, 'coins_earned', v_existing_tx.amount);
    END IF;

    -- Exclude coin-funded spending and ineligible discounts: strictly based on real money/cash paid
    v_real_cash_paid := GREATEST(0.00, COALESCE(v_order.total_egp, 0.00));
    v_coins_to_award := FLOOR(v_real_cash_paid * v_rules.earn_rate_ratio);

    IF v_coins_to_award <= 0 THEN
        RETURN jsonb_build_object('success', true, 'coins_earned', 0);
    END IF;

    -- Concurrency Lock on Wallet
    INSERT INTO public.loyalty_wallets (user_id) VALUES (v_user) ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO v_wallet FROM public.loyalty_wallets WHERE user_id = v_user FOR UPDATE;

    -- Deficit Recovery: Automatically satisfy prior spent-reward deficits before crediting net balance
    v_deficit_to_recover := LEAST(COALESCE(v_wallet.pending_deficit, 0), v_coins_to_award);
    v_net_coins_credited := v_coins_to_award - v_deficit_to_recover;
    v_remaining_deficit := COALESCE(v_wallet.pending_deficit, 0) - v_deficit_to_recover;
    v_new_balance := v_wallet.available_balance + v_net_coins_credited;

    UPDATE public.loyalty_wallets SET
        available_balance = v_new_balance,
        pending_deficit = v_remaining_deficit,
        lifetime_earned = lifetime_earned + v_coins_to_award,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    -- Log recovery in audit log if deficit was recovered
    IF v_deficit_to_recover > 0 THEN
        INSERT INTO public.loyalty_audit_log (
            actor_id, target_user_id, action_type, previous_value, new_value, reason
        ) VALUES (
            COALESCE(auth.uid(), v_user), v_user, 'deficit_recovered',
            jsonb_build_object('order_id', v_order.order_id, 'previous_deficit', v_wallet.pending_deficit, 'coins_earned', v_coins_to_award),
            jsonb_build_object('deficit_recovered', v_deficit_to_recover, 'remaining_deficit', v_remaining_deficit, 'net_credited', v_net_coins_credited),
            'استرداد عجز مالي سابق بقيمة ' || v_deficit_to_recover || ' كوين من أرباح الطلب ' || v_order.order_id
        );
    END IF;

    INSERT INTO public.loyalty_transactions (
        wallet_id,
        user_id,
        order_id,
        order_reference,
        transaction_type,
        amount,
        balance_after,
        status,
        description,
        idempotency_key,
        created_by
    ) VALUES (
        v_wallet.id,
        v_user,
        v_order.id,
        v_order.order_id,
        'purchase_reward',
        v_net_coins_credited,
        v_new_balance,
        'completed',
        CASE WHEN v_deficit_to_recover > 0 
             THEN 'مكافأة ولاء للطلب ' || v_order.order_id || ' (تم خصم ' || v_deficit_to_recover || ' كوين لتسوية عجز سابق، وصافي مضاف ' || v_net_coins_credited || ' كوين)'
             ELSE 'مكافأة ولاء Nexa Coins لاكتمال تسليم الطلب ' || v_order.order_id || ' (من واقع دفع نقدي ' || v_real_cash_paid || ' ج.م)'
        END,
        v_idem_key,
        COALESCE(auth.uid(), v_user)
    );

    UPDATE public.orders SET coins_earned = v_coins_to_award WHERE id = v_order.id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order.order_id,
        'coins_earned', v_coins_to_award,
        'deficit_recovered', v_deficit_to_recover,
        'net_coins_credited', v_net_coins_credited,
        'balance_after', v_new_balance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Public Admin RPC Wrapper
CREATE OR REPLACE FUNCTION public.award_order_coins(p_order_id TEXT)
RETURNS JSONB AS $$
BEGIN
    IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
        RAISE EXCEPTION 'Unauthorized: Only store administrators can manually award coins.';
    END IF;

    RETURN public._internal_award_order_coins(p_order_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 11. INTERNAL & ADMIN RPC: reverse_order_coins (Deficit Accumulation & Accurate Accounting)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._internal_reverse_order_coins(
    p_order_id TEXT,
    p_reason TEXT DEFAULT 'إلغاء الطلب واسترجاع المدفوعات'
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_user UUID;
    v_wallet RECORD;
    v_award_tx RECORD;
    v_redeem_tx RECORD;
    v_reversal_key TEXT;
    v_coins_reversed INT := 0;
    v_coins_to_deduct INT := 0;
    v_deficit INT := 0;
    v_coins_restored INT := 0;
    v_current_balance INT;
BEGIN
    SELECT * INTO v_order 
    FROM public.orders 
    WHERE (order_id = trim(p_order_id) OR UPPER(order_id) = UPPER(trim(p_order_id)) OR id::text = trim(p_order_id))
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    v_user := COALESCE(v_order.customer_account_id, v_order.customer_id);
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('success', true, 'message', 'No customer account linked');
    END IF;

    SELECT * INTO v_wallet FROM public.loyalty_wallets WHERE user_id = v_user FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', true, 'message', 'No wallet found');
    END IF;

    v_current_balance := v_wallet.available_balance;

    -- 1. Reverse Earned Reward if previously credited
    v_reversal_key := 'reversal_award_' || v_order.order_id;
    SELECT * INTO v_award_tx FROM public.loyalty_transactions WHERE idempotency_key = 'award_' || v_order.order_id;
    IF FOUND AND NOT EXISTS (SELECT 1 FROM public.loyalty_transactions WHERE idempotency_key = v_reversal_key) THEN
        v_coins_reversed := v_award_tx.amount;
        -- Reconcile if customer has already spent some or all of the earned coins
        v_coins_to_deduct := LEAST(v_wallet.available_balance, v_coins_reversed);
        v_deficit := v_coins_reversed - v_coins_to_deduct;
        v_current_balance := v_wallet.available_balance - v_coins_to_deduct;

        -- Record deficit on wallet for automatic recovery on future orders
        UPDATE public.loyalty_wallets SET
            available_balance = v_current_balance,
            pending_deficit = pending_deficit + v_deficit,
            lifetime_earned = GREATEST(0, lifetime_earned - v_coins_reversed),
            updated_at = NOW()
        WHERE id = v_wallet.id;

        INSERT INTO public.loyalty_transactions (
            wallet_id, user_id, order_id, order_reference, transaction_type, amount, balance_after, status, description, idempotency_key, created_by
        ) VALUES (
            v_wallet.id, v_user, v_order.id, v_order.order_id, 'refund_reversal', -v_coins_to_deduct, v_current_balance, 'completed', 
            CASE WHEN v_deficit > 0 
                 THEN 'استرجاع مكافأة بعد إلغاء الطلب ' || v_order.order_id || ' (تم خصم ' || v_coins_to_deduct || ' كوين، عجز مستهلك مسبقاً ' || v_deficit || ' كوين مقيد للمطالبة)'
                 ELSE 'استرجاع مكافأة بعد إلغاء الطلب ' || v_order.order_id
            END, 
            v_reversal_key, COALESCE(auth.uid(), v_user)
        );

        -- Audit log deficit if customer had spent earned coins
        IF v_deficit > 0 THEN
            INSERT INTO public.loyalty_audit_log (
                actor_id, target_user_id, action_type, previous_value, new_value, reason
            ) VALUES (
                COALESCE(auth.uid(), v_user), v_user, 'reward_reversal_deficit',
                jsonb_build_object('order_id', v_order.order_id, 'coins_reversed', v_coins_reversed, 'wallet_balance', v_wallet.available_balance),
                jsonb_build_object('coins_deducted', v_coins_to_deduct, 'deficit_added', v_deficit, 'balance_after', v_current_balance),
                'عجز في رصيد الكوينز المسترجعة للطلب ' || v_order.order_id || ' بسبب استهلاك العميل المسبق لها - تم قيد العجز للمطالبة المستقبلية'
            );
        END IF;

        UPDATE public.orders SET coins_earned = 0 WHERE id = v_order.id;
    END IF;

    -- 2. Restore Redeemed Coins back to customer wallet
    v_reversal_key := 'restore_redeem_' || v_order.order_id;
    SELECT * INTO v_redeem_tx FROM public.loyalty_transactions 
    WHERE user_id = v_user AND (order_id = v_order.id OR order_reference = v_order.order_id)
      AND transaction_type = 'redemption_deduction' 
      AND status = 'completed';
      
    IF (FOUND OR COALESCE(v_order.coins_redeemed, 0) > 0) AND NOT EXISTS (SELECT 1 FROM public.loyalty_transactions WHERE idempotency_key = v_reversal_key) THEN
        v_coins_restored := COALESCE(ABS(v_redeem_tx.amount), v_order.coins_redeemed);
        v_current_balance := v_current_balance + v_coins_restored;

        UPDATE public.loyalty_wallets SET
            available_balance = v_current_balance,
            lifetime_redeemed = GREATEST(0, lifetime_redeemed - v_coins_restored),
            updated_at = NOW()
        WHERE id = v_wallet.id;

        INSERT INTO public.loyalty_transactions (
            wallet_id, user_id, order_id, order_reference, transaction_type, amount, balance_after, status, description, idempotency_key, created_by
        ) VALUES (
            v_wallet.id, v_user, v_order.id, v_order.order_id, 'reservation_release', v_coins_restored, v_current_balance, 'completed', 'إعادة العملات المستخدمة بعد إلغاء الطلب ' || v_order.order_id, v_reversal_key, COALESCE(auth.uid(), v_user)
        );

        UPDATE public.orders SET coins_redeemed = 0, coins_discount_egp = 0 WHERE id = v_order.id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'coins_reversed', v_coins_reversed,
        'coins_deducted', v_coins_to_deduct,
        'deficit_logged', v_deficit,
        'coins_restored', v_coins_restored,
        'balance_after', v_current_balance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Public Admin RPC Wrapper
CREATE OR REPLACE FUNCTION public.reverse_order_coins(
    p_order_id TEXT,
    p_reason TEXT DEFAULT 'إلغاء الطلب واسترجاع المدفوعات'
)
RETURNS JSONB AS $$
BEGIN
    IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
        RAISE EXCEPTION 'Unauthorized: Only store administrators can manually reverse coins.';
    END IF;

    RETURN public._internal_reverse_order_coins(p_order_id, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 12. RPC: admin_adjust_customer_coins (Manual Audited Credit/Debit)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_adjust_customer_coins(
    p_customer_id UUID,
    p_amount INT,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_wallet RECORD;
    v_prev_balance INT;
    v_new_balance INT;
BEGIN
    IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can adjust loyalty coins.';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'A descriptive audit reason is mandatory for coin adjustments.';
    END IF;

    INSERT INTO public.loyalty_wallets (user_id) VALUES (p_customer_id) ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO v_wallet FROM public.loyalty_wallets WHERE user_id = p_customer_id FOR UPDATE;

    v_prev_balance := v_wallet.available_balance;
    v_new_balance := v_prev_balance + p_amount;

    IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'Cannot adjust below zero balance. Current: %, Adjustment: %', v_prev_balance, p_amount;
    END IF;

    UPDATE public.loyalty_wallets SET
        available_balance = v_new_balance,
        lifetime_earned = CASE WHEN p_amount > 0 THEN lifetime_earned + p_amount ELSE lifetime_earned END,
        lifetime_redeemed = CASE WHEN p_amount < 0 THEN lifetime_redeemed + ABS(p_amount) ELSE lifetime_redeemed END,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    INSERT INTO public.loyalty_transactions (
        wallet_id, user_id, transaction_type, amount, balance_after, status, description, created_by
    ) VALUES (
        v_wallet.id, p_customer_id, 'admin_adjustment', p_amount, v_new_balance, 'completed', 'تعديل إداري: ' || trim(p_reason), auth.uid()
    );

    INSERT INTO public.loyalty_audit_log (
        actor_id, target_user_id, action_type, previous_value, new_value, reason
    ) VALUES (
        auth.uid(), p_customer_id, 'manual_coin_adjustment', jsonb_build_object('balance', v_prev_balance), jsonb_build_object('balance', v_new_balance, 'adjustment', p_amount), trim(p_reason)
    );

    RETURN jsonb_build_object(
        'success', true,
        'customer_id', p_customer_id,
        'previous_balance', v_prev_balance,
        'adjustment', p_amount,
        'new_balance', v_new_balance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Administrative Update for Loyalty Rules
CREATE OR REPLACE FUNCTION public.admin_update_loyalty_rules(
    p_is_enabled BOOLEAN,
    p_earn_rate_ratio NUMERIC,
    p_redeem_rate_egp NUMERIC,
    p_min_redeem_coins INT,
    p_max_discount_percentage NUMERIC,
    p_allow_full_coin_payment BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
    v_old_rules RECORD;
    v_new_rules RECORD;
BEGIN
    IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can update loyalty policy rules.';
    END IF;

    IF p_earn_rate_ratio IS NULL OR p_earn_rate_ratio <= 0 OR p_earn_rate_ratio > 1.0 THEN
        RAISE EXCEPTION 'Invalid earn rate ratio. Must be between 0.0001 and 1.0.';
    END IF;

    IF p_redeem_rate_egp IS NULL OR p_redeem_rate_egp <= 0 OR p_redeem_rate_egp > 100.0 THEN
        RAISE EXCEPTION 'Invalid redeem rate. Must be between 0.01 and 100.0.';
    END IF;

    IF p_min_redeem_coins IS NULL OR p_min_redeem_coins < 1 THEN
        RAISE EXCEPTION 'Minimum redeem coins must be at least 1.';
    END IF;

    IF p_max_discount_percentage IS NULL OR p_max_discount_percentage <= 0 OR p_max_discount_percentage > 100.0 THEN
        RAISE EXCEPTION 'Max discount percentage must be between 1.0 and 100.0.';
    END IF;

    SELECT * INTO v_old_rules FROM public.loyalty_rules WHERE id = 'default';

    UPDATE public.loyalty_rules SET
        is_enabled = COALESCE(p_is_enabled, true),
        earn_rate_ratio = p_earn_rate_ratio,
        redeem_rate_egp = p_redeem_rate_egp,
        min_redeem_coins = p_min_redeem_coins,
        max_discount_percentage = p_max_discount_percentage,
        allow_full_coin_payment = COALESCE(p_allow_full_coin_payment, true),
        updated_at = NOW(),
        updated_by = auth.uid()
    WHERE id = 'default'
    RETURNING * INTO v_new_rules;

    INSERT INTO public.loyalty_audit_log (
        actor_id, action_type, previous_value, new_value, reason
    ) VALUES (
        auth.uid(), 'update_loyalty_rules', to_jsonb(v_old_rules), to_jsonb(v_new_rules), 'تحديث قواعد وسياسات برنامج ولاء Nexa Coins'
    );

    RETURN jsonb_build_object('success', true, 'rules', to_jsonb(v_new_rules));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 13. RPC: claim_guest_order_with_token (Verified Ownership Claiming ONLY)
-- ------------------------------------------------------------------------------
-- NEVER claims automatically by email or phone match.
-- Strictly requires customer to provide BOTH order_id AND positive access_token match!
CREATE OR REPLACE FUNCTION public.claim_guest_order_with_token(
    p_order_id TEXT,
    p_access_token TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user UUID;
    v_order RECORD;
    v_clean_order_id TEXT;
    v_clean_token TEXT;
    v_token_matches BOOLEAN := false;
BEGIN
    v_user := auth.uid();
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'Authentication required to link orders to your account.';
    END IF;

    v_clean_order_id := trim(COALESCE(p_order_id, ''));
    v_clean_token := trim(COALESCE(p_access_token, ''));

    -- Reject empty or short token inputs immediately
    IF v_clean_order_id = '' OR v_clean_token = '' OR length(v_clean_token) < 8 THEN
        RETURN jsonb_build_object('success', false, 'error', 'رقم الطلب ورمز الوصول السري مطلوبان وصالحان لربط الطلب.');
    END IF;

    SELECT * INTO v_order 
    FROM public.orders 
    WHERE (order_id = v_clean_order_id OR UPPER(order_id) = UPPER(v_clean_order_id) OR id::text = v_clean_order_id) 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'لم يتم العثور على الطلب. يرجى التحقق من الرقم.');
    END IF;

    -- Positive token validation: eliminates any NULL-based comparison bypass
    IF v_order.access_token IS NOT NULL 
       AND length(trim(v_order.access_token)) >= 8 
       AND trim(v_order.access_token) = v_clean_token THEN
        v_token_matches := true;
    ELSIF (v_order.metadata->>'access_token') IS NOT NULL 
          AND length(trim(v_order.metadata->>'access_token')) >= 8 
          AND trim(v_order.metadata->>'access_token') = v_clean_token THEN
        v_token_matches := true;
    END IF;

    IF NOT v_token_matches THEN
        RETURN jsonb_build_object('success', false, 'error', 'رمز الوصول غير صحيح. تعذر ربط الطلب بالحساب.');
    END IF;

    -- Check if already claimed by another user (safe against NULL)
    IF v_order.customer_account_id IS NOT NULL AND v_order.customer_account_id <> v_user THEN
        RETURN jsonb_build_object('success', false, 'error', 'هذا الطلب مسجل ومرتبط بحساب معتمد آخر بالفعل.');
    END IF;

    IF v_order.customer_id IS NOT NULL AND v_order.customer_id <> v_user THEN
        RETURN jsonb_build_object('success', false, 'error', 'هذا الطلب مسجل ومرتبط بحساب معتمد آخر بالفعل.');
    END IF;

    -- Link order to current authenticated user
    UPDATE public.orders SET
        customer_account_id = v_user,
        customer_id = COALESCE(customer_id, v_user),
        metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{claimed_at}', to_jsonb(NOW()::text))
    WHERE id = v_order.id;

    -- If order was already completed, award any pending loyalty coins to newly linked account
    IF v_order.payment_status = 'verified' AND v_order.fulfillment_status = 'fulfilled' AND v_order.coins_earned = 0 THEN
        PERFORM public._internal_award_order_coins(v_order.order_id);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order.order_id,
        'message', 'تم ربط الطلب بحسابك بنجاح!'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 14. TRIGGER: Automated Order Loyalty Lifecycle (Earn on Fulfillment, Reversal on Cancel)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_handle_order_loyalty_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Automatic Awarding: When payment becomes verified AND digital fulfillment is fulfilled
    IF (NEW.payment_status = 'verified' AND NEW.fulfillment_status = 'fulfilled' AND NEW.status <> 'cancelled')
       AND NOT (OLD.payment_status = 'verified' AND OLD.fulfillment_status = 'fulfilled')
       AND (COALESCE(NEW.customer_account_id, NEW.customer_id) IS NOT NULL) THEN
        PERFORM public._internal_award_order_coins(NEW.order_id);
    END IF;

    -- 2. Automatic Reversal: When order is cancelled or rejected, reverse earned rewards AND restore redeemed coins
    IF (NEW.status = 'cancelled' OR NEW.fulfillment_status = 'cancelled' OR NEW.payment_status IN ('rejected', 'refunded'))
       AND (OLD.payment_status = 'verified' OR OLD.fulfillment_status = 'fulfilled' OR COALESCE(OLD.coins_redeemed, 0) > 0 OR COALESCE(OLD.coins_earned, 0) > 0) THEN
        PERFORM public._internal_reverse_order_coins(NEW.order_id, 'إلغاء الطلب أو رفض الدفع');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_order_loyalty_lifecycle ON public.orders;
CREATE TRIGGER trg_order_loyalty_lifecycle
AFTER UPDATE OF payment_status, fulfillment_status, status
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_handle_order_loyalty_lifecycle();

-- ------------------------------------------------------------------------------
-- 15. SECURE PRIVILEGE LOCKDOWN (Explicit Principle of Least Privilege)
-- ------------------------------------------------------------------------------
-- Direct table mutations revoked
REVOKE ALL ON public.loyalty_wallets FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.loyalty_wallets FROM authenticated;
GRANT SELECT ON public.loyalty_wallets TO authenticated;

REVOKE ALL ON public.loyalty_transactions FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.loyalty_transactions FROM authenticated;
GRANT SELECT ON public.loyalty_transactions TO authenticated;

REVOKE ALL ON public.loyalty_audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.loyalty_audit_log TO authenticated;

REVOKE ALL ON public.loyalty_rules FROM PUBLIC, anon;
GRANT SELECT ON public.loyalty_rules TO anon, authenticated;

-- Explicit RPC Permissions
-- Internal core functions: REVOKED from all clients (only service_role / internal definer triggers)
REVOKE ALL ON FUNCTION public._internal_award_order_coins(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._internal_award_order_coins(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public._internal_reverse_order_coins(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._internal_reverse_order_coins(TEXT, TEXT) TO service_role;

-- reserve_and_redeem_coins: authenticated users only
REVOKE ALL ON FUNCTION public.reserve_and_redeem_coins(TEXT, INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_and_redeem_coins(TEXT, INT, TEXT) TO authenticated, service_role;

-- award_order_coins & reverse_order_coins: Public wrappers gated to admins/service_role
REVOKE ALL ON FUNCTION public.award_order_coins(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_order_coins(TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.reverse_order_coins(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_order_coins(TEXT, TEXT) TO authenticated, service_role;

-- admin_adjust_customer_coins & admin_update_loyalty_rules: restricted to admins/service_role
REVOKE ALL ON FUNCTION public.admin_adjust_customer_coins(UUID, INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_customer_coins(UUID, INT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_update_loyalty_rules(BOOLEAN, NUMERIC, NUMERIC, INT, NUMERIC, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_loyalty_rules(BOOLEAN, NUMERIC, NUMERIC, INT, NUMERIC, BOOLEAN) TO authenticated, service_role;

-- claim_guest_order_with_token: authenticated users
REVOKE ALL ON FUNCTION public.claim_guest_order_with_token(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_guest_order_with_token(TEXT, TEXT) TO authenticated, service_role;

-- get_or_create_customer_wallet: authenticated users
REVOKE ALL ON FUNCTION public.get_or_create_customer_wallet(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_customer_wallet(UUID) TO authenticated, service_role;

-- calculate_order_coins_redemption: read-only public calculation
REVOKE ALL ON FUNCTION public.calculate_order_coins_redemption(NUMERIC, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_order_coins_redemption(NUMERIC, INT) TO anon, authenticated, service_role;
