-- 1. First, make sure the "meta" column exists in the orders table 
-- (I noticed it was missing from the DB schema!)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS meta JSONB;

-- 2. Create a dummy user if none exists, or just use an existing one to attach the order to
-- (This creates a fake personalized subscription order that expires exactly 2 days from today)
INSERT INTO public.orders (
  order_number, 
  user_id, 
  customer_name, 
  delivery_date, 
  status, 
  kind, 
  payment_status, 
  meta
)
VALUES (
  'TEST-' || floor(random() * 100000)::text,
  (SELECT id FROM auth.users LIMIT 1), -- fallback to the first user in your auth
  'Test Subscriber',
  CURRENT_DATE,
  'pending',
  'personalized',
  'paid',
  '{"durationDays": 2, "plan": "Test Plan"}'::jsonb
);

SELECT 'Test subscription order created successfully!' as result;
