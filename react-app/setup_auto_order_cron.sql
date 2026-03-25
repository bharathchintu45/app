-- ============================================================
-- TFB Auto Subscription Order Generator — Supabase Cron Setup
-- Run this ONCE in Supabase Dashboard → SQL Editor
-- ============================================================

-- STEP 1: Enable pg_net extension (needed for HTTP calls from Postgres)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- STEP 2: Create (or replace) the scheduler function
-- ⚠️  Replace YOUR_SERVICE_ROLE_KEY below with your actual key:
--     Supabase Dashboard → Settings → API → service_role (secret key)
CREATE OR REPLACE FUNCTION public.trigger_daily_orders_if_time()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  configured_time  text;
  is_enabled       boolean;
  current_ist      text;
  today_date       date;
  last_run_val     text;
  project_url      text  := 'https://ijnigtjlphdeafstnrxk.supabase.co';
  service_key      text  := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjkxODU3NiwiZXhwIjoyMDg4NDk0NTc2fQ.3m-l23p_YG9TboMEgKkE6tmlRagezvmFCmtC3S80AiQ';  -- ⚠️ Replace this!
BEGIN
  -- 1. Read settings
  SELECT value #>> '{}'   INTO configured_time FROM public.app_settings WHERE key = 'auto_order_time'    LIMIT 1;
  SELECT (value)::boolean INTO is_enabled      FROM public.app_settings WHERE key = 'auto_order_enabled' LIMIT 1;
  SELECT value #>> '{}'   INTO last_run_val    FROM public.app_settings WHERE key = 'auto_order_last_run' LIMIT 1;

  -- 2. Exit early if disabled or not configured
  IF NOT COALESCE(is_enabled, false) THEN RETURN; END IF;
  IF configured_time IS NULL OR configured_time = '' THEN RETURN; END IF;

  -- 3. Check if already run today (Prevents double fire in the same minute)
  today_date := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  IF last_run_val IS NOT NULL AND last_run_val = today_date::text THEN
    RETURN;
  END IF;

  -- 4. Check time and trigger
  current_ist := TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'HH24:MI');

  IF current_ist = configured_time THEN
    -- Mark as run first to prevent race conditions
    INSERT INTO public.app_settings (key, value) 
    VALUES ('auto_order_last_run', to_jsonb(today_date::text))
    ON CONFLICT (key) DO UPDATE SET value = to_jsonb(today_date::text);

    PERFORM extensions.http_post(
      url     := project_url || '/functions/v1/api/v1/generate-daily-orders',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || service_key,
        'x-path',        '/v1/generate-daily-orders'
      ),
      body    := jsonb_build_object('targetDate', today_date::text)::text
    );
  END IF;
END;
$$;

-- STEP 3: Seed default settings rows
-- app_settings.value is jsonb — strings must be quoted as JSON strings
INSERT INTO public.app_settings (key, value) VALUES ('auto_order_time',    '"05:00"') ON CONFLICT (key) DO NOTHING;
INSERT INTO public.app_settings (key, value) VALUES ('auto_order_enabled',  'false')  ON CONFLICT (key) DO NOTHING;

-- STEP 4: Register the cron job (runs every minute, server-side — no browser needed)
SELECT cron.schedule(
  'tfb-auto-daily-orders',
  '* * * * *',
  'SELECT public.trigger_daily_orders_if_time();'
);

-- ============================================================
-- VERIFY   : SELECT * FROM cron.job WHERE jobname = 'tfb-auto-daily-orders';
-- UNSCHEDULE: SELECT cron.unschedule('tfb-auto-daily-orders');
-- ============================================================
