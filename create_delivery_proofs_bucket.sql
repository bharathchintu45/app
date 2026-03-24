-- Create the delivery-proofs storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-proofs', 'delivery-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow delivery users to upload proofs
DROP POLICY IF EXISTS "Delivery can upload proofs" ON storage.objects;
CREATE POLICY "Delivery can upload proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'delivery-proofs'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'delivery'
  );

-- Allow anyone to view proofs (public bucket)
DROP POLICY IF EXISTS "Anyone can view proofs" ON storage.objects;
CREATE POLICY "Anyone can view proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'delivery-proofs');

-- Allow delivery users to update/upsert proofs
DROP POLICY IF EXISTS "Delivery can update proofs" ON storage.objects;
CREATE POLICY "Delivery can update proofs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'delivery-proofs'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'delivery'
  );

SELECT 'delivery-proofs bucket created successfully' AS status;
