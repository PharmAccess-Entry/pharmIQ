create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.push_subscriptions enable row level security;

-- Policies
create policy "Users can view their own subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- Also allow staff to view subscriptions for their restaurant (needed by the edge function if we use a service role, but service role bypasses RLS anyway).
-- Edge function uses Service Role key, so it bypasses RLS. We don't need additional read policies.
