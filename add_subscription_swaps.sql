-- Migration to add subscription_swaps table for real-time meal modifications

CREATE TABLE IF NOT EXISTS public.subscription_swaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id TEXT NOT NULL,
    date DATE NOT NULL,
    slot TEXT NOT NULL,
    menu_item_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subscription_id, date, slot)
);

-- Enable RLS
ALTER TABLE public.subscription_swaps ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view swaps
DROP POLICY IF EXISTS "Users can view swaps" ON public.subscription_swaps;
CREATE POLICY "Users can view swaps"
ON public.subscription_swaps FOR SELECT
TO authenticated USING (true);

-- Allow authenticated users to insert swaps
DROP POLICY IF EXISTS "Users can insert swaps" ON public.subscription_swaps;
CREATE POLICY "Users can insert swaps"
ON public.subscription_swaps FOR INSERT
TO authenticated WITH CHECK (true);

-- Allow authenticated users to update swaps
DROP POLICY IF EXISTS "Users can update swaps" ON public.subscription_swaps;
CREATE POLICY "Users can update swaps"
ON public.subscription_swaps FOR UPDATE
TO authenticated USING (true);

-- Allow authenticated users to delete swaps
DROP POLICY IF EXISTS "Users can delete swaps" ON public.subscription_swaps;
CREATE POLICY "Users can delete swaps"
ON public.subscription_swaps FOR DELETE
TO authenticated USING (true);

-- Add estimated_arrival to orders if it doesn't exist
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_arrival TIMESTAMPTZ DEFAULT NULL;
