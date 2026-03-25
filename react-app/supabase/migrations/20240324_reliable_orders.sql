-- RELIABLE ORDER GENERATION MIGRATION
-- 1. Add sync_token to orders for absolute duplicate prevention
-- Format: sub:[uuid]:[date]:[slot]
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sync_token text UNIQUE;

-- 2. Create the unified transaction RPC
-- This ensures Order + Items are created together or not at all
CREATE OR REPLACE FUNCTION create_subscription_order_v2(
    p_user_id uuid,
    p_order_number text,
    p_customer_name text,
    p_delivery_details jsonb,
    p_delivery_date date,
    p_subtotal numeric,
    p_gst_amount numeric,
    p_total numeric,
    p_meta jsonb,
    p_sync_token text,
    p_items jsonb -- Array of {menu_item_id, item_name, quantity, unit_price}
) RETURNS uuid AS $$
DECLARE
    v_order_id uuid;
    v_item jsonb;
BEGIN
    -- 1. Insert Order
    INSERT INTO public.orders (
        user_id, order_number, customer_name, delivery_details, 
        delivery_date, subtotal, gst_amount, total, 
        payment_status, status, kind, meta, sync_token
    ) VALUES (
        p_user_id, p_order_number, p_customer_name, p_delivery_details,
        p_delivery_date, p_subtotal, p_gst_amount, p_total,
        'paid', 'pending', 'personalized', p_meta, p_sync_token
    ) RETURNING id INTO v_order_id;

    -- 2. Insert Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        INSERT INTO public.order_items (
            order_id, menu_item_id, item_name, quantity, unit_price
        ) VALUES (
            v_order_id, 
            (v_item->>'menu_item_id')::uuid, 
            v_item->>'item_name', 
            (v_item->>'quantity')::int, 
            (v_item->>'unit_price')::numeric
        );
    END LOOP;

    RETURN v_order_id;
EXCEPTION WHEN unique_violation THEN
    -- If sync_token already exists, just return NULL or the existing order ID
    -- This prevents the background script from crashing on retries
    RETURN (SELECT id FROM public.orders WHERE sync_token = p_sync_token LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
