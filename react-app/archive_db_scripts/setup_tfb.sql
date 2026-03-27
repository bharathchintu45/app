-- =========================================================================
-- SUPERBASE AUTH & PROFILES DEFINITIVE SETUP SCRIPT
-- RUN THIS ENTIRE SCRIPT AT ONCE IN THE SUPABASE SQL EDITOR
-- =========================================================================

-- 1. CLEAN UP ALL OLD POLICIES & TRIGGERS
-- =========================================================================
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. CREATE / VERIFY PROFILES TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  phone_number text,
  role text DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'kitchen')),
  email text,
  created_at timestamptz DEFAULT now()
);

-- 3. APPLY SIMPLEST, SAFEST RLS POLICIES
-- =========================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Rule 1: Anyone logged in can READ profiles (completely safe, zero infinite loops)
CREATE POLICY "Enable read access for authenticated users" 
ON public.profiles FOR SELECT TO authenticated USING (true);

-- Rule 2: Users can UPDATE their own profile to add their name/phone
CREATE POLICY "Enable update for users based on id" 
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Rule 3: Users can DELETE their own profile
CREATE POLICY "Enable delete for users based on id" 
ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- Note: We do NOT need an INSERT policy, because the database trigger handles inserts!

-- 4. CREATE AUTO-PROFILE TRIGGER
-- =========================================================================
-- This function runs the exact millisecond a user signs up.
-- It automatically builds their profile so the React app never has to!
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, '', 'customer')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the trigger to Supabase Auth
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. ENSURE THE MAIN ADMIN ACCOUNT EXISTS
-- =========================================================================
DO $$ 
DECLARE
  v_admin_uid uuid := extensions.uuid_generate_v4();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@thefitbowls.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role,
      confirmation_token, recovery_token
    ) VALUES (
      v_admin_uid, '00000000-0000-0000-0000-000000000000', 'admin@thefitbowls.com', crypt('Admin@TFB2024!', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', '', ''
    );
    INSERT INTO public.profiles (id, full_name, email, role)
    VALUES (v_admin_uid, 'Administrator', 'admin@thefitbowls.com', 'admin')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
