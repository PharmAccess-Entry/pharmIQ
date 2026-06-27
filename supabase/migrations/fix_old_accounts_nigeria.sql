-- 1. Ensure the country columns exist (in case you missed the previous migration)
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS currency_code text,
ADD COLUMN IF NOT EXISTS currency_symbol text,
ADD COLUMN IF NOT EXISTS timezone text,
ADD COLUMN IF NOT EXISTS language text;

-- 2. Automatically set all existing old accounts (where country is null) to Nigeria
UPDATE public.restaurants
SET 
  country = 'Nigeria',
  currency_code = 'NGN',
  currency_symbol = '₦',
  timezone = 'Africa/Lagos',
  language = 'en-NG'
WHERE country IS NULL;
