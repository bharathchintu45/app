-- Allow admin users (role = 'admin' in profiles table) to update ANY order.
-- This is needed so the admin dashboard can soft-delete (set status=removed_by_admin)
-- any user's subscription without being blocked by RLS.

-- First, ensure RLS is enabled on orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop the old admin update policy if it exists, to avoid conflicts
DROP POLICY IF EXISTS "Admin can update any order" ON public.orders;
DROP POLICY IF EXISTS "Admin can delete any order" ON public.orders;
DROP POLICY IF EXISTS "Admin can select any order" ON public.orders;
DROP POLICY IF EXISTS "Admin can insert any order" ON public.orders;

-- Allow admins full access to all orders
CREATE POLICY "Admin can select any order"
ON public.orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admin can update any order"
ON public.orders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admin can delete any order"
ON public.orders
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admin can insert any order"
ON public.orders
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Users can view/manage their own orders
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;

CREATE POLICY "Users can view own orders"
ON public.orders
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders"
ON public.orders
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders"
ON public.orders
FOR UPDATE
USING (auth.uid() = user_id);

SELECT 'Admin RLS policies applied successfully!' as result;
