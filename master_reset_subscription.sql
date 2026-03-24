-- MASTER RESET FOR SUBSCRIPTION EXPERIMENTS
-- Run this if your Dashboard data looks messy or has extra rollover items you don't want.

DO $$ 
DECLARE
    v_sub_id uuid;
    v_start_date date;
    v_duration integer;
BEGIN
    -- 1. Find the active subscription
    SELECT id, start_date, duration_days INTO v_sub_id, v_start_date, v_duration 
    FROM subscriptions 
    WHERE status = 'active' 
    LIMIT 1;

    IF v_sub_id IS NOT NULL THEN
        -- 2. Clear all experimental holds
        DELETE FROM subscription_holds WHERE subscription_id = v_sub_id;

        -- 3. Clear all experimental swaps (rescheduled items)
        DELETE FROM subscription_swaps WHERE subscription_id = v_sub_id;

        -- 4. Reset the end_date to exactly duration_days from start_date
        -- (This removes any timeline extensions caused by reschedules)
        UPDATE subscriptions 
        SET end_date = (v_start_date + (v_duration - 1) * interval '1 day')::date
        WHERE id = v_sub_id;

        RAISE NOTICE 'Master Reset complete for subscription %', v_sub_id;
    ELSE
        RAISE NOTICE 'No active subscription found to reset.';
    END IF;
END $$;
