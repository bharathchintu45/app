-- MIGRATION: create_subscription_order_v2 — ensure meta always carries is_auto_generated & subscription_id
-- The edge function now always passes these in p_meta, but this migration makes
-- the RPC itself guarantee they are present even if called from other code paths.
-- Safe to re-run (CREATE OR REPLACE).

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
    p_items           jsonb -- [{menu_item_id, item_name, quantity, unit_price}]
) RETURNS uuid AS $$
DECLARE
    v_order_id uuid;
    v_item     jsonb;
    v_meta     jsonb;
BEGIN
    -- Ensure meta always has the required tracing fields
    v_meta := COALESCE(p_meta, '{}'::jsonb)
           || jsonb_build_object(
                'is_auto_generated', true,
                'generated_at',      to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
              );

    -- 1. Insert order (kind = 'subscription', payment_status = 'paid')
    INSERT INTO public.orders (
        user_id, order_number, customer_name, delivery_details,
        delivery_date, subtotal, gst_amount, total,
        payment_status, status, kind, meta, sync_token
    ) VALUES (
        p_user_id, p_order_number, p_customer_name, p_delivery_details,
        p_delivery_date, p_subtotal, p_gst_amount, p_total,
        'paid', 'pending', 'personalized', v_meta, p_sync_token
    ) RETURNING id INTO v_order_id;

    -- 2. Insert order items
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

EXCEPTION
    WHEN unique_violation THEN
        -- Idempotent: if sync_token already exists, return the existing order id
        RETURN (SELECT id FROM public.orders WHERE sync_token = p_sync_token LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
