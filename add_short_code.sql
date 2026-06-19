-- Migration: Add short_code to restaurants
-- Run this in your Supabase SQL Editor

ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS short_code text;

-- Optional: Add a unique constraint if you want short codes to be globally unique
-- ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_short_code_key UNIQUE (short_code);
