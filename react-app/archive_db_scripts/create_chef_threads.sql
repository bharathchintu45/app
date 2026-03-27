-- =========================================================================
-- CREATE CHEF THREADS TABLE
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.chef_threads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name text NOT NULL,
  text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- =========================================================================
-- INDEXES FOR PERFORMANCE
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_chef_threads_customer_id ON public.chef_threads(customer_id);
CREATE INDEX IF NOT EXISTS idx_chef_threads_created_at ON public.chef_threads(created_at);

-- =========================================================================
-- ENABLE RLS
-- =========================================================================
ALTER TABLE public.chef_threads ENABLE ROW LEVEL SECURITY;

-- 1. Customers can read and write their own threads
CREATE POLICY "Customers can read own threads" ON public.chef_threads 
  FOR SELECT TO authenticated 
  USING (
    sender_id = auth.uid() OR 
    customer_id = auth.uid()
  );

CREATE POLICY "Customers can insert own threads" ON public.chef_threads 
  FOR INSERT TO authenticated 
  WITH CHECK (
    sender_id = auth.uid()
  );

-- 2. Admins/Kitchen can read all threads
CREATE POLICY "Staff can read all threads" ON public.chef_threads 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'kitchen')
    )
  );

-- 3. Admins/Kitchen can reply to threads (creating rows for customers)
CREATE POLICY "Staff can insert replies" ON public.chef_threads 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'kitchen')
    ) AND sender_id = auth.uid()
  );

-- Note: No UPDATE or DELETE policies. Messages are immutable append-only logs.

-- =========================================================================
-- ENABLE REALTIME
-- =========================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.chef_threads;
