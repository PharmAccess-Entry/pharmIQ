-- Add options support to menu items and order items
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS options TEXT[] DEFAULT '{}';
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS selected_option TEXT;
