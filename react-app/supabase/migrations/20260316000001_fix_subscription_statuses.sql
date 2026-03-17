-- 1. Drop existing constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- 2. Add updated constraint with all required statuses
-- This includes 'removed_by_admin' and 'paused' which were causing crashes
ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check 
CHECK (status IN (
  'pending', 
  'preparing', 
  'ready', 
  'out_for_delivery', 
  'delivered', 
  'cancelled', 
  'removed_by_admin', 
  'paused'
));

-- 3. Verify and update payment_status constraint
-- Ensure all application-used payment statuses are permitted
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_payment_status_check 
CHECK (payment_status IN (
  'pending', 
  'paid', 
  'failed', 
  'cod_pending'
));

-- Log success
SELECT 'Order and Payment status constraints updated successfully!' as result;
