-- 1. Create the subscription_holds table
CREATE TABLE IF NOT EXISTS public.subscription_holds (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- References auth.users or app_users depending on exact foreign key preference
  hold_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent holding the exact same day twice for the same subscription
  UNIQUE(subscription_id, hold_date)
);

-- 2. Add an index for the cron job to quickly look up holds for today
CREATE INDEX idx_subscription_holds_date ON public.subscription_holds(hold_date);

-- 3. Enable RLS (Row Level Security)
ALTER TABLE public.subscription_holds ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies so users can only view and manage their own holds
CREATE POLICY "Users can view their own holds"
ON public.subscription_holds FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own holds"
ON public.subscription_holds FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own holds"
ON public.subscription_holds FOR DELETE
USING (auth.uid() = user_id);

-- Optional: Create a trigger to prevent holding days in the past
CREATE OR REPLACE FUNCTION check_future_hold_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.hold_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot hold a date in the past';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_future_hold
BEFORE INSERT OR UPDATE ON public.subscription_holds
FOR EACH ROW
EXECUTE FUNCTION check_future_hold_date();
