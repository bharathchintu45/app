-- TFB Order Status Constraint Fix
-- Run this in Supabase SQL Editor → New Query → Run

-- explicitly drop constraint if it exists
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add the new constraint with all required lowercase statuses
ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'));

-- Done!
SELECT 'Order statuses constraint updated successfully!' as result;
