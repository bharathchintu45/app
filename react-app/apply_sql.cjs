/**
 * apply_sql.cjs — runs both the RPC migration and cron SQL against the live DB
 * Uses the supabase-js admin client which goes through PostgREST,
 * so it only supports operations that can be expressed as RPC calls.
 *
 * For raw DDL/SQL we use the Supabase Management API with a service-role JWT.
 * The management API v1 endpoint `POST /v1/projects/{ref}/database/query`
 * accepts arbitrary SQL and requires a personal access token — but we can
 * replicate the same by calling the pg REST endpoint via the pg extension.
 *
 * Fallback: both SQL files are printed so they can be pasted into the
 * Supabase Dashboard SQL Editor as a LAST RESORT.
 */
const { createClient } = require('@supabase/supabase-js');
const fs   = require('fs');
const path = require('path');
const https = require('https');

const URL_  = 'https://ijnigtjlphdeafstnrxk.supabase.co';
const KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjkxODU3NiwiZXhwIjoyMDg4NDk0NTc2fQ.3m-l23p_YG9TboMEgKkE6tmlRagezvmFCmtC3S80AiQ';

const admin = createClient(URL_, KEY);

// The migration SQL as inline string (CREATE OR REPLACE — safe to re-run)
const MIGRATION_SQL = `
CREATE OR REPLACE FUNCTION create_subscription_order_v2(
    p_user_id         uuid,
    p_order_number    text,
    p_customer_name   text,
    p_delivery_details jsonb,
    p_delivery_date   date,
    p_subtotal        numeric,
    p_gst_amount      numeric,
    p_total           numeric,
    p_meta            jsonb,
    p_sync_token      text,
    p_items           jsonb
) RETURNS uuid AS $$
DECLARE
    v_order_id uuid;
    v_item     jsonb;
    v_meta     jsonb;
BEGIN
    v_meta := COALESCE(p_meta, '{}' ::jsonb)
           || jsonb_build_object(
                'is_auto_generated', true,
                'generated_at',      to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
              );
    INSERT INTO public.orders (
        user_id, order_number, customer_name, delivery_details,
        delivery_date, subtotal, gst_amount, total,
        payment_status, status, kind, meta, sync_token
    ) VALUES (
        p_user_id, p_order_number, p_customer_name, p_delivery_details,
        p_delivery_date, p_subtotal, p_gst_amount, p_total,
        'paid', 'pending', 'subscription', v_meta, p_sync_token
    ) RETURNING id INTO v_order_id;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        INSERT INTO public.order_items (order_id, menu_item_id, item_name, quantity, unit_price)
        VALUES (v_order_id, (v_item->>'menu_item_id')::uuid, v_item->>'item_name',
                (v_item->>'quantity')::int, (v_item->>'unit_price')::numeric);
    END LOOP;
    RETURN v_order_id;
EXCEPTION
    WHEN unique_violation THEN
        RETURN (SELECT id FROM public.orders WHERE sync_token = p_sync_token LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

const CRON_SQL = `
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_daily_orders_if_time()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  configured_time text; is_enabled boolean; current_ist text;
  today_date date; last_run_val text;
  project_url text := 'https://ijnigtjlphdeafstnrxk.supabase.co';
  service_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjkxODU3NiwiZXhwIjoyMDg4NDk0NTc2fQ.3m-l23p_YG9TboMEgKkE6tmlRagezvmFCmtC3S80AiQ';
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
    PERFORM net.http_post(
      url := project_url || '/functions/v1/api',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || service_key,'x-path','/v1/generate-daily-orders'),
      body := ('{"targetDate":"' || today_date::text || '"}')::text
    );
  END IF;
END; $$;

INSERT INTO public.app_settings (key, value) VALUES ('auto_order_generation_time', '"05:00"') ON CONFLICT (key) DO NOTHING;
INSERT INTO public.app_settings (key, value) VALUES ('auto_order_generation_enabled', 'false')  ON CONFLICT (key) DO NOTHING;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tfb-auto-daily-orders') THEN
    PERFORM cron.unschedule('tfb-auto-daily-orders');
  END IF;
END $$;

SELECT cron.schedule('tfb-auto-daily-orders', '* * * * *', 'SELECT public.trigger_daily_orders_if_time();');
`;

async function applyViaEdgeFunction(label, sql) {
  // Use the already-deployed edge function to run SQL via a temporary RPC approach.
  // We call /v1/generate-daily-orders with a special debug override that won't exist.
  // Instead, we'll try calling Postgres directly through the admin client's raw query.
  
  // Supabase-js doesn't expose raw SQL. The only built-in way is .rpc()
  // So we'll use the pg REST API: POST /rest/v1/ with Content-Profile = 'public'
  // This only works for SELECT — not DDL.
  
  // Best available option: use fetch to the edge function we just deployed,
  // passing the SQL as a "runSQL" action.
  // But our edge function doesn't have a SQL runner.
  
  // Final fallback: print the SQL and instruct user.
  console.log(`\n${'='.repeat(70)}`);
  console.log(`SQL for: ${label}`);
  console.log('='.repeat(70));
  console.log('Paste this in Supabase Dashboard → SQL Editor:');
  console.log('-'.repeat(70));
  console.log(sql.trim());
  console.log('-'.repeat(70));
}

async function tryDirectFetch(label, sql) {
  // Try Supabase Management API — requires personal access token, not service role
  // So this will fail, but we'll try anyway with service role to check
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/ijnigtjlphdeafstnrxk/database/query`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KEY}`, // service role won't work for mgmt API
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        console.log(`\n[${label}] Management API → HTTP ${res.statusCode}: ${data.slice(0,200)}`);
        resolve(res.statusCode < 300);
      });
    });
    req.on('error', (e) => { console.log(`[${label}] Error: ${e.message}`); resolve(false); });
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('TFB — Applying auto-order SQL changes\n');

  const migOk = await tryDirectFetch('Migration: create_subscription_order_v2', MIGRATION_SQL);
  const cronOk = await tryDirectFetch('Cron: trigger_daily_orders_if_time', CRON_SQL);

  if (!migOk) {
    await applyViaEdgeFunction('Migration: create_subscription_order_v2', MIGRATION_SQL);
  }
  if (!cronOk) {
    await applyViaEdgeFunction('Cron: trigger_daily_orders_if_time + cron.schedule', CRON_SQL);
  }
}

main().catch(console.error);
