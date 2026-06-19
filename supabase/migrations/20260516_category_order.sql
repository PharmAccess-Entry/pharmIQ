ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS category_order text[] DEFAULT '{}'::text[];
