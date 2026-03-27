-- =====================================================
-- ROUND 4: Advanced Vectors
-- =====================================================

-- Fix legacy buggy policies on subscription_holds and subscription_swaps
-- Drop the broken policies that join sub_id to orders.id
DROP POLICY IF EXISTS "Users can manage own holds" ON public.subscription_holds;
DROP POLICY IF EXISTS "Users can manage own swaps" ON public.subscription_swaps;

-- Update the remaining {public} roles to {authenticated} for best practice
DROP POLICY IF EXISTS "Users can manage holds for their subscriptions" ON public.subscription_holds;
CREATE POLICY "Users can manage holds for their subscriptions" ON public.subscription_holds 
FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM subscriptions WHERE subscriptions.id = subscription_holds.subscription_id AND subscriptions.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM subscriptions WHERE subscriptions.id = subscription_holds.subscription_id AND subscriptions.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage swaps for their subscriptions" ON public.subscription_swaps;
CREATE POLICY "Users can manage swaps for their subscriptions" ON public.subscription_swaps 
FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM subscriptions WHERE subscriptions.id = subscription_swaps.subscription_id AND subscriptions.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM subscriptions WHERE subscriptions.id = subscription_swaps.subscription_id AND subscriptions.user_id = auth.uid()));

-- Also restrict the admin policies to authenticated
DROP POLICY IF EXISTS "Admins have full access to subscription_holds" ON public.subscription_holds;
CREATE POLICY "Admins have full access to subscription_holds" ON public.subscription_holds 
FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "Admins have full access to subscription_swaps" ON public.subscription_swaps;
CREATE POLICY "Admins have full access to subscription_swaps" ON public.subscription_swaps 
FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
