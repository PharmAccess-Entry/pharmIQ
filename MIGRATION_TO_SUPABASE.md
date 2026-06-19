# SmartTable Migration to Supabase

Use this file when moving the project to another platform. Run the SQL in order in your new Supabase SQL editor, then copy the Edge Function code from `supabase/functions/*` and configure the same secrets.

## Required secrets

- `PAYSTACK_SECRET_KEY` — Paystack secret key for payments.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` — provided by Supabase in the target project.
- `RESEND_API_KEY` — reserve this name for transactional emails when you obtain the key.

## Schema and policies

```sql
create extension if not exists pgcrypto;

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  name text not null,
  phone text,
  business_type text,
  table_count integer not null default 0,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  logo_url text,
  base_url text,
  subscription_status text not null default 'trial',
  subscription_plan text,
  subscription_period text,
  trial_ends_at timestamptz,
  active_event_id uuid,
  paystack_reference text,
  last_payment_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  name text not null,
  description text,
  price numeric not null,
  category text not null,
  image text,
  available boolean not null default true,
  pairs_with uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  name text not null,
  event_date date,
  table_count integer not null default 0,
  tier text not null default 'small',
  amount numeric not null default 0,
  payment_status text not null default 'unpaid',
  paystack_reference text,
  qr_enabled boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  short_code text not null,
  table_number text not null,
  intent text not null default 'dine-in',
  status text not null default 'pending',
  total numeric not null default 0,
  customer_name text,
  customer_phone text,
  payment_status text not null default 'unpaid',
  payment_screenshot_url text,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  menu_item_id uuid,
  name text not null,
  qty integer not null,
  price numeric not null,
  item_intent text
);

create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  sender text not null,
  kind text not null default 'message',
  body text,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  table_number text,
  type text not null,
  message text,
  name text,
  phone text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.restaurants enable row level security;
alter table public.menu_items enable row level security;
alter table public.events enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_messages enable row level security;
alter table public.customer_requests enable row level security;
alter table public.notifications enable row level security;

create policy "public read restaurants" on public.restaurants for select using (true);
create policy "owner inserts own restaurant" on public.restaurants for insert to authenticated with check (owner_id = auth.uid());
create policy "owner updates own restaurant" on public.restaurants for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner deletes own restaurant" on public.restaurants for delete to authenticated using (owner_id = auth.uid());

create policy "public read menu" on public.menu_items for select using (true);
create policy "auth insert menu" on public.menu_items for insert to authenticated with check (true);
create policy "auth update menu" on public.menu_items for update to authenticated using (true) with check (true);
create policy "auth delete menu" on public.menu_items for delete to authenticated using (true);

create policy "public read events" on public.events for select using (true);
create policy "owner manages own events" on public.events for all to authenticated using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid())) with check (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "public read orders" on public.orders for select using (true);
create policy "public write orders" on public.orders for all using (true) with check (true);
create policy "public read order_items" on public.order_items for select using (true);
create policy "public write order_items" on public.order_items for all using (true) with check (true);
create policy "public read order_messages" on public.order_messages for select using (true);
create policy "public write order_messages" on public.order_messages for all using (true) with check (true);
create policy "public insert customer_requests" on public.customer_requests for insert with check (true);
create policy "auth read customer_requests" on public.customer_requests for select to authenticated using (true);
create policy "auth update customer_requests" on public.customer_requests for update to authenticated using (true) with check (true);
create policy "auth delete customer_requests" on public.customer_requests for delete to authenticated using (true);
create policy "auth read notifications" on public.notifications for select to authenticated using (true);
create policy "public insert notifications" on public.notifications for insert with check (true);
create policy "auth update notifications" on public.notifications for update to authenticated using (true) with check (true);
create policy "auth delete notifications" on public.notifications for delete to authenticated using (true);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

create or replace function public.handle_new_user_restaurant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.restaurants (owner_id, name, table_count, subscription_status, trial_ends_at)
  values (new.id, coalesce(new.raw_user_meta_data->>'restaurant_name', 'My Business'), 0, 'trial', now() + interval '3 days')
  on conflict do nothing;
  return new;
end $$;
```

## Storage buckets

Create public buckets: `logos`, `menu-images`, `payment-screenshots`.

## Current QA status

- Menu suggestions now close the suggestion modal, add rows to the screen instantly, and open a price-entry modal.
- Live/Hidden toggles update optimistically and roll back on failure.
- Delete now uses an app confirmation dialog, not the browser confirm popup.
- Payment activation now uses an account-style header with back/dashboard actions and no public marketing header.
- Payment callback verification no longer calls verify without a reference.

## Security note before production

The current app intentionally allows public QR ordering flows, but several RLS policies are broad for authenticated dashboard operations. Before production, tighten `menu_items`, `orders`, `order_items`, `order_messages`, `notifications`, and `customer_requests` policies to owner/restaurant scoped rules.
```