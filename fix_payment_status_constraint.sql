-- TFB Payment Status Constraint Fix
-- Run this in Supabase SQL Editor → New Query → Run

DO $$ 
DECLARE 
  constraint_name text;
BEGIN
  -- 1. Find the check constraint on the payment_status column
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.orders'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%payment_status%';

  -- 2. Drop it if found explicitly by the found name
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

-- 3. Just in case it was explicitly named "orders_payment_status_check"
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;

-- 4. Add the new constraint with all required payment statuses
ALTER TABLE public.orders
ADD CONSTRAINT orders_payment_status_check 
CHECK (payment_status IN ('pending', 'paid', 'failed', 'cod_pending'));

-- Done!
SELECT 'Payment statuses constraint updated successfully!' as result;
