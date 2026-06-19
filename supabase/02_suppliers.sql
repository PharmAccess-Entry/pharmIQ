-- Phase 2: Supplier Management

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  status text default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Policies using the security definer helpers created in Phase 1
CREATE POLICY "suppliers_all_auth" ON public.suppliers FOR ALL USING (
  auth.uid() IS NOT NULL AND (
    public.is_restaurant_owner(restaurant_id) OR public.is_restaurant_staff(restaurant_id)
  )
);
