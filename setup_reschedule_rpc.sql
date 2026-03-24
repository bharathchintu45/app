-- Create the Reschedule Meal RPC
-- This function securely handles holding a meal on an original day and moving it to a new day.

CREATE OR REPLACE FUNCTION reschedule_meal(
    p_sub_id uuid,
    p_original_date date,
    p_new_date date,
    p_is_full_day boolean,
    p_items jsonb
) RETURNS void AS $$
DECLARE
    v_slots jsonb := '{}'::jsonb;
    v_item RECORD;
BEGIN
    -- 1. Insert into subscription_holds to stop delivery on original day
    IF p_is_full_day THEN
        INSERT INTO subscription_holds (subscription_id, hold_date, is_full_day)
        VALUES (p_sub_id, p_original_date, true)
        ON CONFLICT (subscription_id, hold_date) 
        DO UPDATE SET is_full_day = true;
    ELSE
        -- Build the slots object correctly for partial hounds
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
            v_slots := jsonb_set(v_slots, ARRAY[v_item.value->>'slot'], 'true'::jsonb);
        END LOOP;
        
        -- Insert or merge partial holds
        INSERT INTO subscription_holds (subscription_id, hold_date, is_full_day, slots)
        VALUES (p_sub_id, p_original_date, false, v_slots)
        ON CONFLICT (subscription_id, hold_date) 
        DO UPDATE SET slots = COALESCE(subscription_holds.slots, '{}'::jsonb) || v_slots;
    END IF;

    -- 2. Insert into subscription_swaps to add the meals to the new day
    -- p_items is an array of objects: [{"slot": "Slot1", "menu_item_id": "uuid"}]
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        INSERT INTO subscription_swaps (subscription_id, date, slot, menu_item_id)
        VALUES (p_sub_id, p_new_date, v_item.value->>'slot', v_item.value->>'menu_item_id')
        ON CONFLICT (subscription_id, date, slot)
        DO UPDATE SET menu_item_id = EXCLUDED.menu_item_id;
    END LOOP;

    -- 3. Automatically push back the subscription end_date if the new date is beyond it
    -- This handles the renewal overlap issue seamlessly!
    UPDATE subscriptions
    SET end_date = GREATEST(end_date, p_new_date)
    WHERE id = p_sub_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
