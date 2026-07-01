-- Enable required extensions if they aren't already
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Schedule the telegram-cron (runs every hour at minute 0)
select cron.schedule(
  'telegram-cron-hourly',
  '0 * * * *',
  $$
    select net.http_post(
      url:='https://ohmfcouxtdjmbugmnqub.supabase.co/functions/v1/telegram-cron',
      headers:='{"Content-Type": "application/json"}'::jsonb
    );
  $$
);

-- Schedule the check-expiring-subs (runs once a day at 10:00 AM UTC)
select cron.schedule(
  'check-expiring-subs-daily',
  '0 10 * * *',
  $$
    select net.http_post(
      url:='https://ohmfcouxtdjmbugmnqub.supabase.co/functions/v1/check-expiring-subs',
      headers:='{"Content-Type": "application/json"}'::jsonb
    );
  $$
);
