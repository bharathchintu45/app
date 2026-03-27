-- Fix Manager Access to Catalog Uploads

-- 1. Update Storage Policy for `menu-images`
DROP POLICY IF EXISTS "Admin CRUD Access" ON storage.objects;
DROP POLICY IF EXISTS "Manager/Admin CRUD Access" ON storage.objects;

CREATE POLICY "Manager/Admin CRUD Access"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'menu-images' AND 
  public.is_manager_or_admin()
)
WITH CHECK (
  bucket_id = 'menu-images' AND 
  public.is_manager_or_admin()
);

SELECT 'Manager upload access fixed successfully!' as result;
