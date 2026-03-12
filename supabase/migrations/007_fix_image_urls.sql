-- Fix product image URLs that point to the local proxy instead of real Supabase.
-- This handles images uploaded while the dashboard Supabase client was configured
-- to use the FastAPI proxy URL.

UPDATE product_images
SET url = REPLACE(url, 'http://localhost:8000/storage/v1/', 'https://vovopiuloxhhywfhltdi.supabase.co/storage/v1/')
WHERE url LIKE 'http://localhost:8000/storage/v1/%';

