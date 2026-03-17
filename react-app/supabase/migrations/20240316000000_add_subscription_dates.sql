-- Add dedicated subscription tracking columns to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_days INTEGER;

-- Optional: Indexing for performance if we query by these dates often
CREATE INDEX IF NOT EXISTS idx_orders_subscription_dates ON public.orders (start_date, end_date) WHERE kind = 'personalized';

-- Comment explaining the columns
COMMENT ON COLUMN public.orders.start_date IS 'The inclusive first day of the subscription.';
COMMENT ON COLUMN public.orders.end_date IS 'The inclusive last day of the subscription.';
COMMENT ON COLUMN public.orders.total_days IS 'The duration of the subscription in days (e.g. 7, 15, 30).';
