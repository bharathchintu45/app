const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://ijnigtjlphdeafstnrxk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg1NzYsImV4cCI6MjA4ODQ5NDU3Nn0.QvRpJXtbS8CtoVctipcThItHXgcoS9GZzyXhhDBIh3c';

// Using SERVICE ROLE KEY to execute raw SQL (needed for creating functions)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjkxODU3NiwiZXhwIjoyMDg4NDk0NTc2fQ.C5h-W_zM0W0G0iHZZKx_A3yQx176r2qB-1E_cRz-zJ4'; 
const supabase = createClient(supabaseUrl, serviceRoleKey);

const sql = `
-- Drop existing if any
DROP FUNCTION IF EXISTS reschedule_meal(uuid, date, date, boolean, jsonb);

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
        -- Build the slots object correctly for partial bounds
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
            v_slots := jsonb_set(v_slots, ARRAY[v_item.value->>'slot'], 'true'::jsonb);
        END LOOP;
        
        INSERT INTO subscription_holds (subscription_id, hold_date, is_full_day, slots)
        VALUES (p_sub_id, p_original_date, false, v_slots)
        ON CONFLICT (subscription_id, hold_date) 
        DO UPDATE SET slots = subscription_holds.slots || v_slots;
    END IF;

    -- 2. Insert into subscription_swaps to force delivery on new day
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        INSERT INTO subscription_swaps (subscription_id, date, slot, menu_item_id)
        VALUES (p_sub_id, p_new_date, v_item.value->>'slot', (v_item.value->>'menu_item_id')::uuid)
        ON CONFLICT (subscription_id, date, slot)
        DO UPDATE SET menu_item_id = EXCLUDED.menu_item_id;
    END LOOP;

    -- 3. Extend the subscription end_date if p_new_date pushes it
    UPDATE subscriptions
    SET end_date = GREATEST(end_date, p_new_date)
    WHERE id = p_sub_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function applySQL() {
   try {
       // Since the rest API endpoint doesn't strictly allow raw SQL strings without the postgres extension rpc (or using a migration runner), 
       // I'll create a lightweight execute function if the query extension is active OR I'll just write it to a .sql file
       // Wait, directly executing raw SQL via supabase-js is not fully supported without an extension like 'exec_sql'.
       // Alternatively, create a generic SQL runner file for local supabase CLI if it exists?
   } catch(e) {}
}
// just write the sql to file so the user can easily copy/paste or execute via terminal
fs.writeFileSync('apply_reschedule_rpc.sql', sql);
console.log('SQL generated. Execute it in the Supabase Dashboard SQL Editor.');
