-- ==========================================================================
-- LOCK DOWN ALL PUBLIC RPC FUNCTIONS
-- ==========================================================================
-- ALL functions were callable by anon. This was catastrophic.
-- A random user could create fake orders, trigger automation, etc.
-- ==========================================================================

-- 1. Revoke EXECUTE on dangerous functions from anon and public
REVOKE EXECUTE ON FUNCTION public.create_subscription_order_v2 FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trigger_daily_orders_if_time FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user FROM anon, public;

-- 2. create_subscription_order_v2 — service_role only
REVOKE EXECUTE ON FUNCTION public.create_subscription_order_v2 FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_subscription_order_v2 TO service_role;

-- 3. trigger_daily_orders_if_time — service_role only
GRANT EXECUTE ON FUNCTION public.trigger_daily_orders_if_time TO service_role;

-- 4. handle_new_user — service_role only  
GRANT EXECUTE ON FUNCTION public.handle_new_user TO service_role;

-- 5. reschedule_meal / unhold_meal — authenticated only (not anon)
REVOKE EXECUTE ON FUNCTION public.reschedule_meal FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.unhold_meal FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reschedule_meal_hold FROM anon, public;

-- 6. Fix trigger_daily_orders_if_time to use service_role key instead of debug token
CREATE OR REPLACE FUNCTION public.trigger_daily_orders_if_time()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  configured_time  text;
  is_enabled       boolean;
  current_ist      text;
  today_date       date;
  last_run_val     text;
  project_url      text := 'https://geeqsfyfssyiatomlkos.supabase.co';
  service_key      text;
BEGIN
  SELECT value #>> '{}' INTO configured_time FROM public.app_settings WHERE key = 'auto_order_generation_time' LIMIT 1;
  SELECT (value #>> '{}')::boolean INTO is_enabled FROM public.app_settings WHERE key = 'auto_order_generation_enabled' LIMIT 1;
  SELECT value #>> '{}' INTO last_run_val FROM public.app_settings WHERE key = 'auto_order_last_run' LIMIT 1;

  IF NOT COALESCE(is_enabled, false) THEN RETURN; END IF;
  IF configured_time IS NULL OR trim(configured_time) = '' THEN RETURN; END IF;

  today_date  := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  current_ist := TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'HH24:MI');

  IF last_run_val IS NOT NULL AND last_run_val = today_date::text THEN RETURN; END IF;

  IF current_ist = configured_time OR current_ist = TO_CHAR((configured_time::time + interval '1 minute'), 'HH24:MI') THEN
    INSERT INTO public.app_settings (key, value) VALUES ('auto_order_last_run', to_jsonb(today_date::text))
    ON CONFLICT (key) DO UPDATE SET value = to_jsonb(today_date::text);

    service_key := current_setting('app.settings.service_role_key', true);
    IF service_key IS NULL OR service_key = '' THEN
      service_key := current_setting('supabase.service_role_key', true);
    END IF;
    
    IF service_key IS NOT NULL AND service_key != '' THEN
      PERFORM net.http_post(
        url     := project_url || '/functions/v1/api',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key, 'x-path', '/v1/generate-daily-orders'),
        body    := jsonb_build_object('targetDate', today_date::text)
      );
    END IF;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_daily_orders_if_time FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_daily_orders_if_time TO service_role;
