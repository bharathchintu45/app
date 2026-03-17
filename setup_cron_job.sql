-- 1. Ensure required extensions are enabled via the Supabase Dashboard:
-- Go to Database -> Extensions in your Supabase dashboard and enable:
-- - pg_cron
-- - pg_net

-- 2. Schedule the Edge Function
-- Adjust the URL and Bearer Token (Service Role Key) for your production environment.
-- The cron expression '0 19 * * *' runs it every day at 19:00 UTC (12:30 AM IST next day).
-- You can change this to '0 18 * * *' for 11:30 PM IST if you prefer it to run earlier.

SELECT cron.schedule(
    'invoke-generate-daily-orders', 
    '0 19 * * *', 
    $$
    SELECT net.http_post(
        url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/generate-daily-orders',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
        body := '{}'::jsonb
    ) as request_id;
    $$
);

-- Note: To view or unschedule cron jobs:
-- SELECT * FROM cron.job;
-- SELECT cron.unschedule('invoke-generate-daily-orders');
