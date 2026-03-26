-- ═══════════════════════════════════════════════════════════
-- TFB BASELINE SCHEMA — Run this in TFB-Project-Dev SQL Editor
-- This recreates ALL tables from Production
-- ═══════════════════════════════════════════════════════════

-- 1. PROFILES (must be first — other tables reference it)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY, -- matches auth.users.id
  full_name TEXT,
  phone_number TEXT,
  email TEXT,
  address TEXT,
  dietary_preferences TEXT[],
  dietary_goal TEXT,
  is_pro BOOLEAN DEFAULT false,
  pro_expiry TIMESTAMPTZ,
  health_score INTEGER DEFAULT 0,
  role TEXT DEFAULT 'customer',
  default_delivery JSONB,
  saved_addresses JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. MENU ITEMS
CREATE TABLE IF NOT EXISTS public.menu_items (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  calories INTEGER,
  protein INTEGER,
  carbs INTEGER,
  fat INTEGER,
  fiber INTEGER,
  price_inr INTEGER,
  available BOOLEAN DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  order_number TEXT,
  user_id UUID,
  status TEXT DEFAULT 'pending',
  kind TEXT DEFAULT 'regular',
  payment_status TEXT DEFAULT 'pending',
  subtotal NUMERIC DEFAULT 0,
  gst_amount NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  delivery_fee NUMERIC DEFAULT 0,
  delivery_date DATE,
  delivery_details JSONB,
  notes TEXT,
  customer_name TEXT,
  meta JSONB,
  start_date DATE,
  end_date DATE,
  total_days INTEGER,
  sync_token TEXT
);

-- 4. ORDER ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  item_name TEXT
);

-- 5. SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  plan_name TEXT NOT NULL DEFAULT 'Custom Plan',
  plan_type TEXT,
  duration_days INTEGER NOT NULL DEFAULT 30,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  schedule JSONB DEFAULT '[]'::jsonb,
  delivery_details JSONB DEFAULT '{}'::jsonb,
  targets JSONB DEFAULT '{}'::jsonb,
  meta JSONB DEFAULT '{}'::jsonb,
  total NUMERIC DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'paid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. SUBSCRIPTION HOLDS
CREATE TABLE IF NOT EXISTS public.subscription_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  hold_date TEXT NOT NULL,
  is_full_day BOOLEAN DEFAULT true,
  slots JSONB DEFAULT '{}'::jsonb,
  meta JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. SUBSCRIPTION SWAPS
CREATE TABLE IF NOT EXISTS public.subscription_swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  slot TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  original_date DATE,
  original_slot TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. CHEF THREADS (Chat)
CREATE TABLE IF NOT EXISTS public.chef_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID,
  sender_id UUID,
  sender_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. APP SETTINGS
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'true'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. DELIVERY BOYS
CREATE TABLE IF NOT EXISTS public.delivery_boys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID,
  name TEXT NOT NULL,
  phone TEXT,
  vehicle TEXT DEFAULT 'Bike',
  zone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. DELIVERY ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.delivery_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  delivery_boy_id UUID REFERENCES public.delivery_boys(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'assigned',
  assigned_by UUID,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  delivery_notes TEXT
);

-- ═══════════════════════════════════════════════════════════
-- INDEXES (Performance)
-- ═══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON public.orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscription_holds_sub_id ON public.subscription_holds(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_swaps_sub_id ON public.subscription_swaps(subscription_id);
CREATE INDEX IF NOT EXISTS idx_chef_threads_customer ON public.chef_threads(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order ON public.delivery_assignments(order_id);

-- ═══════════════════════════════════════════════════════════
-- RLS (Row Level Security) — Enable on all tables
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chef_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_boys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════
-- RLS POLICIES — Allow authenticated users to access their data
-- ═══════════════════════════════════════════════════════════

-- Profiles: Users can read/update their own profile
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Menu Items: Everyone can read
CREATE POLICY "Public menu read" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "Admin menu write" ON public.menu_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Orders: Users see own, admin sees all
CREATE POLICY "Users read own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin all orders" ON public.orders FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'kitchen'))
);

-- Order Items: Follow parent order
CREATE POLICY "Users read own order items" ON public.order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "Users insert order items" ON public.order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "Admin all order items" ON public.order_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'kitchen'))
);

-- Subscriptions: Users see own
CREATE POLICY "Users read own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert subscriptions" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own subscriptions" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admin all subscriptions" ON public.subscriptions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Subscription Holds/Swaps: Users manage own via subscription
CREATE POLICY "Users manage own holds" ON public.subscription_holds FOR ALL USING (
  EXISTS (SELECT 1 FROM public.subscriptions WHERE subscriptions.id = subscription_holds.subscription_id AND subscriptions.user_id = auth.uid())
);
CREATE POLICY "Users manage own swaps" ON public.subscription_swaps FOR ALL USING (
  EXISTS (SELECT 1 FROM public.subscriptions WHERE subscriptions.id = subscription_swaps.subscription_id AND subscriptions.user_id = auth.uid())
);

-- Chef Threads: Users see own threads
CREATE POLICY "Users read own threads" ON public.chef_threads FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Users insert threads" ON public.chef_threads FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Admin all threads" ON public.chef_threads FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'kitchen'))
);

-- App Settings: Everyone reads, admin writes
CREATE POLICY "Public settings read" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admin settings write" ON public.app_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Delivery: Admin/Manager only
CREATE POLICY "Admin delivery boys" ON public.delivery_boys FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);
CREATE POLICY "Public read delivery boys" ON public.delivery_boys FOR SELECT USING (true);

CREATE POLICY "Admin delivery assignments" ON public.delivery_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

-- ═══════════════════════════════════════════════════════════
-- AUTO-CREATE PROFILE ON SIGNUP (Trigger)
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone_number, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'EMPTY'),
    COALESCE(NEW.phone, 'EMPTY'),
    NEW.email,
    'customer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════
-- SEED DATA — Default app settings
-- ═══════════════════════════════════════════════════════════
INSERT INTO public.app_settings (key, value) VALUES
  ('gst_rate', '5'::jsonb),
  ('delivery_fee', '30'::jsonb),
  ('free_delivery_minimum', '200'::jsonb),
  ('chef_note', '"Welcome to TFB Dev Environment! 🧪"'::jsonb),
  ('chef_note_enabled', 'true'::jsonb),
  ('personalized_discount', '0'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- DONE! Your Dev database is ready. 🎉
-- ═══════════════════════════════════════════════════════════
