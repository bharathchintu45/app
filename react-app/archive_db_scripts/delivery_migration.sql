-- ================================================================
-- DELIVERY SYSTEM MIGRATIONS
-- Run this in Supabase Dashboard → SQL Editor
-- Order: Run all 4 steps in sequence
-- ================================================================

-- ─── STEP 1: Allow 'delivery' role in profiles ──────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('customer','admin','kitchen','delivery'));


-- ─── STEP 2: Create delivery_boys table ─────────────────────────
CREATE TABLE IF NOT EXISTS delivery_boys (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id),
  name       TEXT NOT NULL,
  phone      TEXT,
  vehicle    TEXT DEFAULT 'Bike',
  zone       TEXT,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE delivery_boys ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "delivery_boys_admin_all" ON delivery_boys;
CREATE POLICY "delivery_boys_admin_all" ON delivery_boys FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Delivery boys can view their own record
DROP POLICY IF EXISTS "delivery_boys_self_view" ON delivery_boys;
CREATE POLICY "delivery_boys_self_view" ON delivery_boys FOR SELECT
  USING (profile_id = auth.uid());

-- Kitchen can view active delivery boys to assign to orders
DROP POLICY IF EXISTS "delivery_boys_kitchen_view" ON delivery_boys;
CREATE POLICY "delivery_boys_kitchen_view" ON delivery_boys FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'kitchen');


-- ─── STEP 3: Create delivery_assignments table ───────────────────
CREATE TABLE IF NOT EXISTS delivery_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE,
  delivery_boy_id UUID REFERENCES delivery_boys(id),
  status          TEXT DEFAULT 'assigned'
    CHECK (status IN ('assigned','picked_up','out_for_delivery','delivered','failed')),
  assigned_by     UUID REFERENCES profiles(id),
  assigned_at     TIMESTAMPTZ DEFAULT NOW(),
  picked_up_at    TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  delivery_notes  TEXT
);

ALTER TABLE delivery_assignments ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "assignments_admin_all" ON delivery_assignments;
CREATE POLICY "assignments_admin_all" ON delivery_assignments FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Kitchen can view and create assignments
DROP POLICY IF EXISTS "assignments_kitchen_all" ON delivery_assignments;
CREATE POLICY "assignments_kitchen_all" ON delivery_assignments FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'kitchen')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'kitchen');

-- Delivery boys can view/update their own assignments
DROP POLICY IF EXISTS "assignments_delivery_own" ON delivery_assignments;
CREATE POLICY "assignments_delivery_own" ON delivery_assignments FOR ALL
  USING (
    delivery_boy_id IN (
      SELECT id FROM delivery_boys WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    delivery_boy_id IN (
      SELECT id FROM delivery_boys WHERE profile_id = auth.uid()
    )
  );

-- Customers can view their own order's assignment (for tracking)
DROP POLICY IF EXISTS "assignments_customer_view" ON delivery_assignments;
CREATE POLICY "assignments_customer_view" ON delivery_assignments FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders WHERE user_id = auth.uid()
    )
  );


-- ─── STEP 4: DB trigger to sync orders.status ───────────────────
CREATE OR REPLACE FUNCTION sync_order_from_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Map assignment status → order status
  UPDATE orders SET status =
    CASE NEW.status
      WHEN 'assigned'         THEN 'out_for_delivery'
      WHEN 'picked_up'        THEN 'out_for_delivery'
      WHEN 'out_for_delivery' THEN 'out_for_delivery'
      WHEN 'delivered'        THEN 'delivered'
      WHEN 'failed'           THEN 'pending'
      ELSE status  -- no change for unknown status
    END
  WHERE id = NEW.order_id;

  -- Stamp picked_up_at timestamp
  IF NEW.status = 'picked_up' AND OLD.status != 'picked_up' THEN
    UPDATE delivery_assignments SET picked_up_at = NOW() WHERE id = NEW.id;
  END IF;

  -- Stamp delivered_at timestamp
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    UPDATE delivery_assignments SET delivered_at = NOW() WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists then recreate (safe re-run)
DROP TRIGGER IF EXISTS trg_assignment_status ON delivery_assignments;

CREATE TRIGGER trg_assignment_status
  AFTER INSERT OR UPDATE OF status ON delivery_assignments
  FOR EACH ROW EXECUTE FUNCTION sync_order_from_assignment();


-- ─── DONE: Verify tables exist ──────────────────────────────────
SELECT 'delivery_boys' as table_name, COUNT(*) FROM delivery_boys
UNION ALL
SELECT 'delivery_assignments', COUNT(*) FROM delivery_assignments;
