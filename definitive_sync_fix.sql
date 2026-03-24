-- THE DEFINITIVE SYNC FIX (V4)
-- This script wipes out all old broken versions and installs the final, robust logic.

-- 1. CLEANUP: Delete every possible old version to fix "Ambigous Function" errors
DROP FUNCTION IF EXISTS reschedule_meal(uuid, date, date, boolean, jsonb);
DROP FUNCTION IF EXISTS reschedule_meal(uuid, text, text, boolean, jsonb);
DROP FUNCTION IF EXISTS unhold_meal(uuid, date, text);
DROP FUNCTION IF EXISTS unhold_meal(uuid, text, text);

-- 2. THE MASTER RESCHEDULE RPC
CREATE OR REPLACE FUNCTION reschedule_meal(
    p_sub_id uuid,
    p_original_date text,
    p_new_date text,
    p_is_full_day boolean,
    p_items jsonb
) RETURNS void AS $$
DECLARE
    v_slots jsonb := '{}'::jsonb;
    v_item RECORD;
BEGIN
    -- [A] HOLD original day
    IF p_is_full_day THEN
        INSERT INTO subscription_holds (subscription_id, hold_date, is_full_day, slots)
        VALUES (p_sub_id, p_original_date, true, '{}'::jsonb)
        ON CONFLICT (subscription_id, hold_date) DO UPDATE SET is_full_day = true;
    ELSE
        -- Build slots object e.g. {"Slot1": true}
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
            v_slots := jsonb_set(v_slots, ARRAY[v_item.value->>'slot'], 'true'::jsonb);
        END LOOP;
        
        INSERT INTO subscription_holds (subscription_id, hold_date, is_full_day, slots)
        VALUES (p_sub_id, p_original_date, false, v_slots)
        ON CONFLICT (subscription_id, hold_date) 
        DO UPDATE SET slots = COALESCE(subscription_holds.slots, '{}'::jsonb) || v_slots;
    END IF;

    -- [B] SWAP to new day (with tracking)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        INSERT INTO subscription_swaps (subscription_id, date, slot, menu_item_id, original_date)
        VALUES (p_sub_id, p_new_date, v_item.value->>'slot', v_item.value->>'menu_item_id', p_original_date::date)
        ON CONFLICT (subscription_id, date, slot)
        DO UPDATE SET menu_item_id = EXCLUDED.menu_item_id, original_date = EXCLUDED.original_date;
    END LOOP;

    -- [C] EXTEND timeline
    UPDATE subscriptions
    SET end_date = GREATEST(end_date, p_new_date::date)
    WHERE id = p_sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. THE MASTER UNHOLD RPC
CREATE OR REPLACE FUNCTION unhold_meal(
    p_sub_id uuid,
    p_date text,
    p_slot text DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_original_end date;
    v_max_swap_date date;
    v_is_currently_full_day boolean;
    v_plan_slots jsonb;
BEGIN
    -- 1. Handle Hold table cleanup
    IF p_slot IS NULL THEN
        -- Unhold the entire day
        DELETE FROM subscription_holds WHERE subscription_id = p_sub_id AND hold_date = p_date;
        DELETE FROM subscription_swaps WHERE subscription_id = p_sub_id AND original_date = p_date::date;
    ELSE
        -- Partial unhold: we need to find if it was a full day hold
        SELECT is_full_day INTO v_is_currently_full_day 
        FROM subscription_holds WHERE subscription_id = p_sub_id AND hold_date = p_date;

        IF v_is_currently_full_day THEN
            -- IF it was a full day hold, we convert it to a partial hold of ALL OTHER slots
            -- Get all slots for this subscription (from the subscriptions table)
            SELECT jsonb_object_agg(elem->>'slot', 'true') INTO v_plan_slots
            FROM (
                SELECT jsonb_array_elements(schedule) as elem 
                FROM subscriptions WHERE id = p_sub_id
            ) s;
            
            -- Remove the slot we are unholding
            v_plan_slots := v_plan_slots - p_slot;
            
            UPDATE subscription_holds 
            SET slots = v_plan_slots, is_full_day = false
            WHERE subscription_id = p_sub_id AND hold_date = p_date;
        ELSE
            -- Just remove the single slot from the existing slots object
            UPDATE subscription_holds 
            SET slots = slots - p_slot
            WHERE subscription_id = p_sub_id AND hold_date = p_date;
        END IF;

        -- Cleanup row if empty
        DELETE FROM subscription_holds 
        WHERE subscription_id = p_sub_id AND hold_date = p_date 
        AND (slots IS NULL OR slots = '{}'::jsonb);

        -- Delete the specific swap
        DELETE FROM subscription_swaps 
        WHERE subscription_id = p_sub_id AND original_date = p_date::date AND slot = p_slot;
    END IF;

    -- 2. Timeline Cleanup
    SELECT (start_date + (duration_days - 1) * interval '1 day')::date INTO v_original_end
    FROM subscriptions WHERE id = p_sub_id;

    SELECT MAX(date) INTO v_max_swap_date
    FROM subscription_swaps WHERE subscription_id = p_sub_id;

    UPDATE subscriptions
    SET end_date = GREATEST(v_original_end, COALESCE(v_max_swap_date::date, v_original_end))
    WHERE id = p_sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
