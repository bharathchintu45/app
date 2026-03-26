-- ============================================================
-- TFB Auto Subscription Order Generator — Supabase Cron Setup
-- Run this ONCE in Supabase Dashboard → SQL Editor
-- ============================================================

-- STEP 0: Ensure pg_net is available (pg_cron is pre-installed on Supabase — do NOT re-create it)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================
-- STEP 1: Create the scheduler trigger function
-- ============================================================
-- Replace the service key below if it has changed:
--   Supabase Dashboard → Settings → API → service_role (secret)

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

  -- ▼ Update these two values if the project URL or service key changes
  project_url      text := 'https://ijnigtjlphdeafstnrxk.supabase.co';
  service_key      text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjkxODU3NiwiZXhwIjoyMDg4NDk0NTc2fQ.3m-l23p_YG9TboMEgKkE6tmlRagezvmFCmtC3S80AiQ';
BEGIN

  -- 1. Read settings from app_settings
  --    value is stored as jsonb; use #>> '{}' to extract the raw text value
  SELECT value #>> '{}'          INTO configured_time
    FROM public.app_settings WHERE key = 'auto_order_generation_time'    LIMIT 1;

  SELECT (value #>> '{}')::boolean INTO is_enabled
    FROM public.app_settings WHERE key = 'auto_order_generation_enabled' LIMIT 1;

  SELECT value #>> '{}'          INTO last_run_val
    FROM public.app_settings WHERE key = 'auto_order_last_run'           LIMIT 1;

  -- 2. Guard: disabled or not configured
  IF NOT COALESCE(is_enabled, false) THEN
    RETURN;
  END IF;

  IF configured_time IS NULL OR trim(configured_time) = '' THEN
    RETURN;
  END IF;

  -- 3. Current IST time and date
  today_date  := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  current_ist := TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'HH24:MI');

  -- 4. Guard: already ran today (prevents double-fire across the 2-minute window)
  IF last_run_val IS NOT NULL AND last_run_val = today_date::text THEN
    RETURN;
  END IF;

  -- 5. Time check: fire if current IST minute is the configured minute
  --    We use a 2-minute window (current_ist OR one minute earlier) so that
  --    a 30-60 second cron processing delay never causes us to miss the slot.
  IF current_ist = configured_time
     OR current_ist = TO_CHAR(
          (configured_time::time + interval '1 minute'),
          'HH24:MI'
        )
  THEN
    -- Mark as run BEFORE making the HTTP call to prevent race conditions
    INSERT INTO public.app_settings (key, value)
      VALUES ('auto_order_last_run', to_jsonb(today_date::text))
      ON CONFLICT (key) DO UPDATE SET value = to_jsonb(today_date::text);

    -- Invoke the edge function via pg_net
    PERFORM net.http_post(
      url     := project_url || '/functions/v1/api',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer TFB_DEBUG_VERIFY_2026',
        'x-path',        '/v1/generate-daily-orders'
      ),
      body    := jsonb_build_object('targetDate', today_date::text)
    );
  END IF;

END;
$$;

-- ============================================================
-- STEP 2: Seed default app_settings rows
--         (safe — skipped if rows already exist)
-- ============================================================
INSERT INTO public.app_settings (key, value)
  VALUES ('auto_order_generation_time',    '"05:00"')
  ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value)
  VALUES ('auto_order_generation_enabled',  'false')
  ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- STEP 3: Register the cron job (runs every minute)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tfb-auto-daily-orders') THEN
    PERFORM cron.unschedule('tfb-auto-daily-orders');
  END IF;
END $$;

SELECT cron.schedule(
  'tfb-auto-daily-orders',
  '* * * * *',
  'SELECT public.trigger_daily_orders_if_time();'
);

-- ============================================================
-- VERIFY   : SELECT * FROM cron.job WHERE jobname = 'tfb-auto-daily-orders';
-- TRIGGER  : SELECT public.trigger_daily_orders_if_time();  — runs immediately
-- LAST RUN : SELECT key, value FROM app_settings WHERE key = 'auto_order_last_run';
-- UNSCHEDULE: SELECT cron.unschedule('tfb-auto-daily-orders');
-- ============================================================
