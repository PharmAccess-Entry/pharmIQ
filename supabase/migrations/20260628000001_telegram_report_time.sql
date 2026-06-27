-- Migration: 20260628000001_telegram_report_time
-- Description: Add custom time for automated Telegram daily reports.

ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS telegram_report_time time without time zone DEFAULT '22:00:00',
ADD COLUMN IF NOT EXISTS telegram_report_timezone text DEFAULT 'Africa/Lagos';
