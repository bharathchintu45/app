-- FINAL SYNCHRONIZED FIX (V3)
-- Corrects the data types AND removes old duplicate functions.

-- 1. Remove old versions to prevent "ambiguous function" errors
DROP FUNCTION IF EXISTS reschedule_meal(uuid, date, date, boolean, jsonb);
DROP FUNCTION IF EXISTS reschedule_meal(uuid, text, text, boolean, jsonb);
DROP FUNCTION IF EXISTS unhold_meal(uuid, date, text);
DROP FUNCTION IF EXISTS unhold_meal(uuid, text, text);

-- 2. Correct the Reschedule RPC
CREATE OR REPLACE FUNCTION reschedule_meal(
    p_sub_id uuid,
    p_original_date text, -- Changed to text to match table
    p_new_date text,      -- Changed to text to match table
    p_is_full_day boolean,
    p_items jsonb
) RETURNS void AS $$
DECLARE
    v_slots jsonb := '{}'::jsonb;
    v_item RECORD;
BEGIN
    -- [Hold Logic]
    IF p_is_full_day THEN
        INSERT INTO subscription_holds (subscription_id, hold_date, is_full_day)
        VALUES (p_sub_id, p_original_date, true)
        ON CONFLICT (subscription_id, hold_date) DO UPDATE SET is_full_day = true;
    ELSE
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
            v_slots := jsonb_set(v_slots, ARRAY[v_item.value->>'slot'], 'true'::jsonb);
        END LOOP;
        INSERT INTO subscription_holds (subscription_id, hold_date, is_full_day, slots)
        VALUES (p_sub_id, p_original_date, false, v_slots)
        ON CONFLICT (subscription_id, hold_date) 
        DO UPDATE SET slots = COALESCE(subscription_holds.slots, '{}'::jsonb) || v_slots;
    END IF;

    -- [Swap Logic]
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        INSERT INTO subscription_swaps (subscription_id, date, slot, menu_item_id, original_date)
        VALUES (p_sub_id, p_new_date, v_item.value->>'slot', v_item.value->>'menu_item_id', p_original_date::date)
        ON CONFLICT (subscription_id, date, slot)
        DO UPDATE SET menu_item_id = EXCLUDED.menu_item_id, original_date = EXCLUDED.original_date;
    END LOOP;

    -- [Timeline Logic]
    UPDATE subscriptions
    SET end_date = GREATEST(end_date, p_new_date::date)
    WHERE id = p_sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Correct the Unhold RPC
CREATE OR REPLACE FUNCTION unhold_meal(
    p_sub_id uuid,
    p_date text, -- Changed to text to match table
    p_slot text DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_original_end date;
    v_max_swap_date date;
BEGIN
    -- 1. Remove from subscription_holds
    IF p_slot IS NULL THEN
        DELETE FROM subscription_holds WHERE subscription_id = p_sub_id AND hold_date = p_date;
    ELSE
        UPDATE subscription_holds 
        SET slots = slots - p_slot, is_full_day = false
        WHERE subscription_id = p_sub_id AND hold_date = p_date;
        
        DELETE FROM subscription_holds 
        WHERE subscription_id = p_sub_id AND hold_date = p_date 
        AND (slots IS NULL OR slots = '{}'::jsonb);
    END IF;

    -- 2. Remove the corresponding swap (using the source date)
    IF p_slot IS NULL THEN
        DELETE FROM subscription_swaps 
        WHERE subscription_id = p_sub_id AND original_date = p_date::date;
    ELSE
        DELETE FROM subscription_swaps 
        WHERE subscription_id = p_sub_id AND original_date = p_date::date AND slot = p_slot;
    END IF;

    -- 3. [Timeline Cleanup]
    SELECT (start_date + (duration_days - 1) * interval '1 day')::date INTO v_original_end
    FROM subscriptions WHERE id = p_sub_id;

    SELECT MAX(date) INTO v_max_swap_date
    FROM subscription_swaps WHERE subscription_id = p_sub_id;

    UPDATE subscriptions
    SET end_date = GREATEST(v_original_end, COALESCE(v_max_swap_date::date, v_original_end))
    WHERE id = p_sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
