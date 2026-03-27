-- ==========================================================================
-- COMPREHENSIVE SECURITY HARDENING
-- ==========================================================================
-- Fixes all vulnerabilities found during deep security audit.
-- Applied: 2026-03-27
-- ==========================================================================

-- =====================
-- 1. FIX menu_items: delete/insert use is_staff() — too permissive
--    A kitchen staff user could add/delete menu items. Only admins should.
-- =====================
DROP POLICY IF EXISTS "Admins can delete menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Admins can insert menu items" ON public.menu_items;

-- These are now redundant since "Admins: manage" (FOR ALL) already covers admin.
-- But let's be explicit for manager access too:
DROP POLICY IF EXISTS "Managers: manage menu" ON public.menu_items;
CREATE POLICY "Managers: manage menu"
ON public.menu_items FOR ALL
USING (public.is_manager_or_admin())
WITH CHECK (public.is_manager_or_admin());

-- =====================
-- 2. FIX orders: Missing staff view/update policies
--    Staff (kitchen/delivery) need to see all orders to do their job,
--    but the main migration only has admin full access + user own access.
-- =====================
DROP POLICY IF EXISTS "Staff: view all orders" ON public.orders;
DROP POLICY IF EXISTS "Staff: update orders" ON public.orders;

CREATE POLICY "Staff: view all orders"
ON public.orders FOR SELECT
USING (public.check_is_staff());

CREATE POLICY "Staff: update orders"
ON public.orders FOR UPDATE
USING (public.check_is_staff());

-- =====================
-- 3. FIX delivery-proofs storage bucket: ZERO policies on live DB
--    Anyone could upload/download/delete delivery proof photos.
-- =====================
-- Ensure bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-proofs', 'delivery-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop any old policies that might exist
DROP POLICY IF EXISTS "Delivery proofs public read" ON storage.objects;
DROP POLICY IF EXISTS "Delivery proofs staff upload" ON storage.objects;
DROP POLICY IF EXISTS "Delivery proofs admin delete" ON storage.objects;

-- Public can VIEW proofs (needed for admin panel and customer order tracking)
CREATE POLICY "Delivery proofs public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'delivery-proofs');

-- Only staff can UPLOAD proofs
CREATE POLICY "Delivery proofs staff upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-proofs' AND
  public.check_is_staff()
);

-- Only admin can DELETE proofs
CREATE POLICY "Delivery proofs admin delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'delivery-proofs' AND
  public.check_is_admin()
);

-- =====================
-- 4. FIX app_settings: insert/update policies use inline subqueries
--    instead of SECURITY DEFINER functions. Risk of recursion.
-- =====================
DROP POLICY IF EXISTS "Admins can insert settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.app_settings;

CREATE POLICY "Admins can insert settings"
ON public.app_settings FOR INSERT
WITH CHECK (public.check_is_admin());

CREATE POLICY "Admins can update settings"
ON public.app_settings FOR UPDATE
USING (public.check_is_admin());

-- =====================
-- 5. FIX subscriptions: Users can currently UPDATE any column on their
--    own subscription (status, payment_status, total, etc.)
--    This should be restricted — users shouldn't change payment_status or total.
--    We add a trigger similar to the profiles role trigger.
-- =====================
CREATE OR REPLACE FUNCTION public.prevent_subscription_fraud()
RETURNS TRIGGER AS $$
BEGIN
  -- Block customers from changing sensitive fields
  IF NOT public.check_is_admin() THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'You cannot change subscription status directly.';
    END IF;
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      RAISE EXCEPTION 'You cannot change payment status.';
    END IF;
    IF NEW.total IS DISTINCT FROM OLD.total THEN
      RAISE EXCEPTION 'You cannot change subscription total.';
    END IF;
    IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
      RAISE EXCEPTION 'You cannot change subscription dates.';
    END IF;
    IF NEW.end_date IS DISTINCT FROM OLD.end_date THEN
      RAISE EXCEPTION 'You cannot change subscription dates.';
    END IF;
    IF NEW.duration_days IS DISTINCT FROM OLD.duration_days THEN
      RAISE EXCEPTION 'You cannot change subscription duration.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_subscription_fraud ON public.subscriptions;
CREATE TRIGGER trg_prevent_subscription_fraud
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_subscription_fraud();

-- =====================
-- 6. FIX orders: Users can UPDATE their own orders (no column restriction).
--    A user could change their order's payment_status from 'pending' to 'paid'
--    to get free food. Block sensitive field changes.
-- =====================
CREATE OR REPLACE FUNCTION public.prevent_order_fraud()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.check_is_staff() THEN
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      RAISE EXCEPTION 'You cannot change payment status.';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'You cannot change order status.';
    END IF;
    IF NEW.total IS DISTINCT FROM OLD.total THEN
      RAISE EXCEPTION 'You cannot change order total.';
    END IF;
    IF NEW.subtotal IS DISTINCT FROM OLD.subtotal THEN
      RAISE EXCEPTION 'You cannot change order subtotal.';
    END IF;
    IF NEW.gst_amount IS DISTINCT FROM OLD.gst_amount THEN
      RAISE EXCEPTION 'You cannot change order tax.';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'You cannot reassign orders.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_order_fraud ON public.orders;
CREATE TRIGGER trg_prevent_order_fraud
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_order_fraud();

-- =====================
-- DONE
-- =====================
SELECT 'Comprehensive security hardening complete!' as result;
