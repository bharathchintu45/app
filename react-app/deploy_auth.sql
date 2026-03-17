-- ==========================================
-- DEFINITIVE PURE AUTHENTICATION SETUP
-- ==========================================
-- This script safely tears down existing complex policies
-- and creates a perfectly standard, robust Supabase Auth integration.

-- 1. Create the profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    email TEXT,
    phone_number TEXT,
    role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'kitchen')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Safely drop ALL existing RLS policies on the profiles table
DO $$ 
DECLARE 
  pol record;
BEGIN 
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- 4. Create simple, pristine RLS Policies (No loops or complex subqueries)
-- Anyone can view profiles (needed for public lookups sometimes, but we can restrict to self)
CREATE POLICY "Users can view their own profile."
    ON public.profiles FOR SELECT
    USING ( auth.uid() = id );

CREATE POLICY "Admins can view all profiles."
    ON public.profiles FOR SELECT
    USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' );

CREATE POLICY "Users can update their own profile."
    ON public.profiles FOR UPDATE
    USING ( auth.uid() = id );

CREATE POLICY "Users can insert their own profile."
    ON public.profiles FOR INSERT
    WITH CHECK ( auth.uid() = id );

-- 5. Establish the absolute standard Supabase best-practice Trigger:
-- Automatically create a profile row the exact millisecond a user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'customer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists, then recreate it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Backfill any existing users who somehow don't have a profile yet (Zombie User Fix)
INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, '', 'customer'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 7. (Optional but recommended) Admin Account Force-Setup
-- If you want to log in to the admin portal, ensure this exact user exists.
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role
)
SELECT 
  gen_random_uuid(),
  'admin@thefitbowls.com',
  crypt('Admin@TFB2024!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now(), 'authenticated'
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'admin@thefitbowls.com'
);

-- Force the admin user's profile role to 'admin'
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@thefitbowls.com';
