-- Migration to enforce unique barcodes (ignoring nulls/empty strings)
-- Ensures duplicate barcodes cannot be added which breaks POS scanning

-- Create a partial unique index on barcode to ensure uniqueness per pharmacy/restaurant
-- We ignore NULL and empty string since many products don't have barcodes
CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_items_barcode_unique 
ON public.menu_items (restaurant_id, barcode) 
WHERE barcode IS NOT NULL AND barcode != '';
