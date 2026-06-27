-- Migration: 20260627000000_enhancements
-- Description: Adds Telegram integration fields and country/currency detection fields to restaurants.

ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS telegram_bot_token text,
ADD COLUMN IF NOT EXISTS telegram_chat_id text,
ADD COLUMN IF NOT EXISTS telegram_bot_name text,
ADD COLUMN IF NOT EXISTS telegram_enabled boolean not null default false,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS currency_code text,
ADD COLUMN IF NOT EXISTS currency_symbol text,
ADD COLUMN IF NOT EXISTS timezone text,
ADD COLUMN IF NOT EXISTS language text;
