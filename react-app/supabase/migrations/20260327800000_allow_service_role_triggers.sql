-- Fix security triggers to allow service_role (webhooks/backend) to update sensitive fields
CREATE OR REPLACE FUNCTION public.prevent_subscription_fraud()
RETURNS TRIGGER AS $$
DECLARE
  v_auth_role text;
BEGIN
  -- Get the JWT role securely using Supabase's built-in function
  -- This will be 'service_role' for edge functions using service key
  v_auth_role := auth.role();
  
  -- If it's service role, allow the update immediately
  IF v_auth_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NOT public.check_is_admin() THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Unauthorized field change'; END IF;
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN RAISE EXCEPTION 'Unauthorized field change'; END IF;
    IF NEW.total IS DISTINCT FROM OLD.total THEN RAISE EXCEPTION 'Unauthorized field change'; END IF;
    IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN RAISE EXCEPTION 'Unauthorized field change'; END IF;
    IF NEW.end_date IS DISTINCT FROM OLD.end_date THEN RAISE EXCEPTION 'Unauthorized field change'; END IF;
    IF NEW.duration_days IS DISTINCT FROM OLD.duration_days THEN RAISE EXCEPTION 'Unauthorized field change'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.prevent_order_fraud()
RETURNS TRIGGER AS $$
DECLARE
  v_auth_role text;
BEGIN
  v_auth_role := auth.role();
  
  IF v_auth_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NOT public.check_is_staff() THEN
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN RAISE EXCEPTION 'Unauthorized field change'; END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Unauthorized field change'; END IF;
    IF NEW.total IS DISTINCT FROM OLD.total THEN RAISE EXCEPTION 'Unauthorized field change'; END IF;
    IF NEW.subtotal IS DISTINCT FROM OLD.subtotal THEN RAISE EXCEPTION 'Unauthorized field change'; END IF;
    IF NEW.gst_amount IS DISTINCT FROM OLD.gst_amount THEN RAISE EXCEPTION 'Unauthorized field change'; END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Unauthorized field change'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
