-- ==========================================
-- RECONCILE SUBSCRIPTIONS & FIX RLS
-- ==========================================

-- 1. Ensure foreign keys for tracking tables point to orders(id)
-- We assume these tables exist but might have broken/legacy references.
-- If they don't exist, we create them correctly.

CREATE TABLE IF NOT EXISTS public.subscription_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    hold_date TEXT NOT NULL,
    is_full_day BOOLEAN DEFAULT true,
    slots JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(subscription_id, hold_date)
);

CREATE TABLE IF NOT EXISTS public.subscription_swaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    slot TEXT NOT NULL,
    menu_item_id TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(subscription_id, date, slot)
);

-- 2. ENABLE RLS
ALTER TABLE public.subscription_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_swaps ENABLE ROW LEVEL SECURITY;

-- 3. POLICIES: Users can manage their own holds/swaps
-- We join with orders to verify ownership

DROP POLICY IF EXISTS "Users can manage own holds" ON public.subscription_holds;
CREATE POLICY "Users can manage own holds"
ON public.subscription_holds
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = subscription_holds.subscription_id
        AND orders.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can manage own swaps" ON public.subscription_swaps;
CREATE POLICY "Users can manage own swaps"
ON public.subscription_swaps
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = subscription_swaps.subscription_id
        AND orders.user_id = auth.uid()
    )
);

-- 4. STAFF ACCESS
DROP POLICY IF EXISTS "Staff can read all holds" ON public.subscription_holds;
CREATE POLICY "Staff can read all holds"
ON public.subscription_holds
FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can read all swaps" ON public.subscription_swaps;
CREATE POLICY "Staff can read all swaps"
ON public.subscription_swaps
FOR SELECT
TO authenticated
USING (public.is_staff());

-- 5. COMPATIBILITY VIEW (Optional but recommended)
-- If some legacy code still looks for a 'subscriptions' table
CREATE OR REPLACE VIEW public.subscriptions AS
SELECT * FROM public.orders WHERE kind = 'personalized';

-- 6. ENSURE NEW SETTINGS EXIST
INSERT INTO public.app_settings (key, value)
VALUES 
    ('rewards_enabled', 'true'),
    ('referral_program_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
