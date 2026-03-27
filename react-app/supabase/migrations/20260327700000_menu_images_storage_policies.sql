-- Create proper policies for the menu-images bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('menu-images', 'menu-images', true) ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Menu images public read" ON storage.objects;
DROP POLICY IF EXISTS "Menu images staff upload" ON storage.objects;
DROP POLICY IF EXISTS "Menu images staff update" ON storage.objects;
DROP POLICY IF EXISTS "Menu images admin delete" ON storage.objects;

CREATE POLICY "Menu images public read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'menu-images');
CREATE POLICY "Menu images staff upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'menu-images' AND public.is_manager_or_admin());
CREATE POLICY "Menu images staff update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'menu-images' AND public.is_manager_or_admin());
CREATE POLICY "Menu images admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'menu-images' AND public.check_is_admin());
