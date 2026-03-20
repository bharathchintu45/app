-- Fix RLS Policies for subscription_holds
ALTER TABLE public.subscription_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage holds for their subscriptions" ON public.subscription_holds;
CREATE POLICY "Users can manage holds for their subscriptions"
ON public.subscription_holds
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE subscriptions.id = subscription_holds.subscription_id
    AND subscriptions.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE subscriptions.id = subscription_holds.subscription_id
    AND subscriptions.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins have full access to subscription_holds" ON public.subscription_holds;
CREATE POLICY "Admins have full access to subscription_holds"
ON public.subscription_holds
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Fix RLS Policies for subscription_swaps
ALTER TABLE public.subscription_swaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage swaps for their subscriptions" ON public.subscription_swaps;
CREATE POLICY "Users can manage swaps for their subscriptions"
ON public.subscription_swaps
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE subscriptions.id = subscription_swaps.subscription_id
    AND subscriptions.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE subscriptions.id = subscription_swaps.subscription_id
    AND subscriptions.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins have full access to subscription_swaps" ON public.subscription_swaps;
CREATE POLICY "Admins have full access to subscription_swaps"
ON public.subscription_swaps
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);
