-- ==========================================================
-- FIX HOLD & SWAP TABLES — Run this in Supabase SQL Editor
-- ==========================================================

-- Drop existing tables if they exist (so we can recreate cleanly)
DROP TABLE IF EXISTS public.subscription_swaps;
DROP TABLE IF EXISTS public.subscription_holds;

-- 1. Create subscription_holds (linked to orders table)
CREATE TABLE public.subscription_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    hold_date TEXT NOT NULL,
    is_full_day BOOLEAN DEFAULT true,
    slots JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT subscription_holds_unique UNIQUE(subscription_id, hold_date)
);

-- 2. Create subscription_swaps (linked to orders table)
CREATE TABLE public.subscription_swaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    slot TEXT NOT NULL,
    menu_item_id TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT subscription_swaps_unique UNIQUE(subscription_id, date, slot)
);

-- 3. Enable Row Level Security
ALTER TABLE public.subscription_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_swaps ENABLE ROW LEVEL SECURITY;

-- 4. HOLDS Policy: Users can manage their own holds via orders.user_id
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
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = subscription_holds.subscription_id
        AND orders.user_id = auth.uid()
    )
);

-- 5. SWAPS Policy: Users can manage their own swaps via orders.user_id
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
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = subscription_swaps.subscription_id
        AND orders.user_id = auth.uid()
    )
);

-- 6. Allow admins/staff full access (based on profiles.role)
DROP POLICY IF EXISTS "Staff can manage all holds" ON public.subscription_holds;
CREATE POLICY "Staff can manage all holds"
ON public.subscription_holds
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'kitchen', 'staff')
    )
);

DROP POLICY IF EXISTS "Staff can manage all swaps" ON public.subscription_swaps;
CREATE POLICY "Staff can manage all swaps"
ON public.subscription_swaps
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'kitchen', 'staff')
    )
);

-- 7. Ensure reward/referral app settings exist
INSERT INTO public.app_settings (key, value)
VALUES 
    ('rewards_enabled', 'true'),
    ('referral_program_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Done!
SELECT 'Hold and Swap tables created successfully!' AS status;
