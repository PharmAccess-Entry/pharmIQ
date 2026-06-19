-- Create the "logos" storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (in case it isn't enabled)
-- (Removed ALTER TABLE because it causes a permissions error; usually it's already enabled by default)

-- Allow public read access to logos
CREATE POLICY "Public Read Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'logos');

-- Allow authenticated users to upload logos
CREATE POLICY "Authenticated Users Can Upload" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');

-- Allow authenticated users to update their uploaded logos
CREATE POLICY "Authenticated Users Can Update" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their logos
CREATE POLICY "Authenticated Users Can Delete" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'logos' AND auth.role() = 'authenticated');
