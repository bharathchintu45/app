-- 1. Add tracked field 'original_slot' to subscription_swaps and fix existing data
ALTER TABLE subscription_swaps ADD COLUMN IF NOT EXISTS original_slot text;
UPDATE subscription_swaps SET original_slot = slot WHERE original_slot IS NULL;

-- 2. Upgrade the Reschedule Meal RPC to track both original_date AND original_slot
DROP FUNCTION IF EXISTS reschedule_meal(uuid, date, date, boolean, jsonb);
DROP FUNCTION IF EXISTS reschedule_meal(uuid, text, text, boolean, jsonb);

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
    v_orig_date date := p_original_date::date;
    v_new_date date := p_new_date::date;
BEGIN
    -- 1. Insert into subscription_holds to stop delivery on original day
    IF p_is_full_day THEN
        INSERT INTO subscription_holds (subscription_id, hold_date, is_full_day)
        VALUES (p_sub_id, p_original_date, true)
        ON CONFLICT (subscription_id, hold_date) 
        DO UPDATE SET is_full_day = true;
    ELSE
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
            v_slots := jsonb_set(v_slots, ARRAY[COALESCE(v_item.value->>'original_slot', v_item.value->>'slot')], 'true'::jsonb);
        END LOOP;
        
        INSERT INTO subscription_holds (subscription_id, hold_date, is_full_day, slots)
        VALUES (p_sub_id, p_original_date, false, v_slots)
        ON CONFLICT (subscription_id, hold_date) 
        DO UPDATE SET slots = COALESCE(subscription_holds.slots, '{}'::jsonb) || v_slots;
    END IF;

    -- 2. Insert into subscription_swaps to add the meals to the new day AND track source data
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        INSERT INTO subscription_swaps (subscription_id, date, slot, menu_item_id, original_date, original_slot)
        VALUES (
            p_sub_id, 
            p_new_date, 
            COALESCE(v_item.value->>'target_slot', v_item.value->>'slot'), 
            v_item.value->>'menu_item_id',
            v_orig_date,
            COALESCE(v_item.value->>'original_slot', v_item.value->>'slot')
        )
        ON CONFLICT (subscription_id, date, slot)
        DO UPDATE SET menu_item_id = EXCLUDED.menu_item_id, original_date = EXCLUDED.original_date, original_slot = EXCLUDED.original_slot;
    END LOOP;

    -- 3. Automatically push back the subscription end_date if the new date is beyond it
    UPDATE subscriptions
    SET end_date = GREATEST(end_date, v_new_date)
    WHERE id = p_sub_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Upgrade the Unhold RPC to use the new original_slot tracking
DROP FUNCTION IF EXISTS unhold_meal(uuid, date, text);
DROP FUNCTION IF EXISTS unhold_meal(uuid, text, text);

CREATE OR REPLACE FUNCTION unhold_meal(
    p_sub_id uuid,
    p_date text,
    p_slot text DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_original_end date;
    v_max_swap_date date;
    v_date date := p_date::date;
BEGIN
    -- 1. Remove from subscription_holds (hold_date is TEXT)
    IF p_slot IS NULL THEN
        DELETE FROM subscription_holds WHERE subscription_id = p_sub_id AND hold_date = p_date;
    ELSE
        -- Partial unhold: remove slot from the JSON object
        UPDATE subscription_holds 
        SET slots = slots - p_slot, is_full_day = false
        WHERE subscription_id = p_sub_id AND hold_date = p_date;
        
        -- Delete row if no slots left
        DELETE FROM subscription_holds 
        WHERE subscription_id = p_sub_id AND hold_date = p_date 
        AND (slots IS NULL OR slots = '{}'::jsonb);
    END IF;

    -- 2. CRITICAL FIX: Remove from subscription_swaps using original_slot
    IF p_slot IS NULL THEN
        DELETE FROM subscription_swaps 
        WHERE subscription_id = p_sub_id AND original_date = v_date;
    ELSE
        DELETE FROM subscription_swaps 
        WHERE subscription_id = p_sub_id AND original_date = v_date AND original_slot = p_slot;
    END IF;

    -- 3. [Timeline Cleanup] Pull back the end_date if we just deleted the latest buffer day
    SELECT (start_date + (duration_days - 1) * interval '1 day')::date INTO v_original_end
    FROM subscriptions WHERE id = p_sub_id;

    SELECT MAX(date) INTO v_max_swap_date
    FROM subscription_swaps WHERE subscription_id = p_sub_id;

    UPDATE subscriptions
    SET end_date = GREATEST(v_original_end, COALESCE(v_max_swap_date, v_original_end))
    WHERE id = p_sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
