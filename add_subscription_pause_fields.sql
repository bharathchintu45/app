-- Migration to add Pause and Cancel fields to the subscriptions table

ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS pause_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pause_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancellation_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pause_reason TEXT DEFAULT NULL;

-- Ensure the existing status constraint allows for "paused" and "cancelled"
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check 
CHECK (status IN ('active', 'inactive', 'paused', 'cancelled', 'past_due', 'trialing'));

-- Comment on columns for future reference
COMMENT ON COLUMN public.subscriptions.pause_start_date IS 'The date when the subscription pause begins.';
COMMENT ON COLUMN public.subscriptions.pause_end_date IS 'The date when the subscription pause automatically ends, resuming the subscription.';
COMMENT ON COLUMN public.subscriptions.cancellation_date IS 'The date when the subscription was cancelled.';
