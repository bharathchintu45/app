-- ============================================================
-- SUBSCRIPTION SYSTEM REWRITE
-- Creates a dedicated `subscriptions` table separate from orders
-- ============================================================

-- 0. Cleanup any existing view/table collision
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'subscriptions' AND c.relkind = 'v') THEN
        DROP VIEW public.subscriptions CASCADE;
    ELSIF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'subscriptions' AND c.relkind = 'r') THEN
        DROP TABLE public.subscriptions CASCADE;
    END IF;
END $$;

-- 1. Create the subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_name    TEXT NOT NULL DEFAULT '',
  plan_name        TEXT NOT NULL DEFAULT 'Custom Plan',
  plan_type        TEXT,  -- e.g. 'Full Day', 'Lunch Only', 'Breakfast + Lunch'
  duration_days    INTEGER NOT NULL DEFAULT 30,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,  -- start_date + duration_days - 1
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'paused', 'cancelled')),
  schedule         JSONB DEFAULT '[]',     -- [{day, slot, itemId, label, qty}, ...]
  delivery_details JSONB DEFAULT '{}',    -- {receiverName, receiverPhone, building, street, area}
  targets          JSONB DEFAULT '{}',    -- {calories, protein, carbs, fat, fiber}
  meta             JSONB DEFAULT '{}',    -- extra data (plan config, notes, etc.)
  total            NUMERIC(10, 2) DEFAULT 0,
  payment_status   TEXT NOT NULL DEFAULT 'paid'
                   CHECK (payment_status IN ('pending', 'paid', 'failed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_dates ON public.subscriptions (start_date, end_date);

-- 3. Enable Row Level Security
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Users can only see their own subscriptions
DROP POLICY IF EXISTS "Users: view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users: view own subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users: insert own subscriptions" ON public.subscriptions;
CREATE POLICY "Users: insert own subscriptions"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins have full access (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Admins: full access to subscriptions" ON public.subscriptions;
CREATE POLICY "Admins: full access to subscriptions"
  ON public.subscriptions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 5. Also fix admin RLS on orders table (for regular/group order management)
DROP POLICY IF EXISTS "Admins: full access to orders" ON public.orders;
CREATE POLICY "Admins: full access to orders"
  ON public.orders
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

SELECT 'subscriptions table and RLS policies created successfully!' AS result;
