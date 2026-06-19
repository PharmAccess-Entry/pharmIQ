# SmartTable Nigeria — Backend Migration Guide

This document explains how to take the **frontend prototype** (currently using
mock data in `src/lib/mockData.ts`) to a **production backend** powered by
Lovable Cloud (Supabase under the hood).

> All SQL lives in [`./schema.sql`](./schema.sql). Apply it as one migration.

---

## 1. Enable Lovable Cloud

In the Lovable editor, ask the AI to **enable Lovable Cloud**. This provisions:

- PostgreSQL database
- Authentication (email + password, social providers)
- File storage (for menu item images)
- Edge functions (for Paystack webhooks)

No external Supabase account needed.

## 2. Apply the schema

Copy `schema.sql` into the Cloud SQL editor and run it. It creates:

| Table | Purpose |
|------|---------|
| `restaurants` | Per-tenant restaurant profile (name, bank, table count) |
| `profiles` | Public user info linked to `auth.users` |
| `user_roles` | **Separate** roles table — never store roles on `profiles` |
| `menu_categories` / `menu_items` | The menu, per restaurant |
| `restaurant_tables` | One row per table, holds the QR token |
| `orders` / `order_items` | Live orders placed via QR |
| `customer_requests` | Call-waiter / help / complaint events |
| `subscriptions` | Paystack subscription state |

### Key security choices

- **Roles in a dedicated table** + `has_role()` `SECURITY DEFINER` function to
  prevent recursive RLS and privilege escalation.
- **Public RLS** on menu reads, table lookup by QR token, and order inserts —
  so unauthenticated diners can scan & order.
- **Member-only RLS** on management endpoints, gated by
  `is_restaurant_member(restaurant_id)`.
- **Auto-profile** on signup via `handle_new_user` trigger.
- **Realtime** enabled on `orders`, `order_items`, `customer_requests` for
  the live dashboard.

## 3. Replace mock data — file by file

| Frontend file | Replace with |
|---|---|
| `src/lib/mockData.ts` `mockMenu` | `supabase.from('menu_items').select('*, menu_categories(name)')` |
| `src/lib/mockData.ts` `mockOrders` | `supabase.from('orders').select('*, order_items(*)').order('placed_at', {ascending:false})` |
| `src/lib/mockData.ts` `plans` | Keep static (pricing tiers don't need DB) |
| `src/pages/Login.tsx` submit handler | `supabase.auth.signInWithPassword({ email, password })` |
| `src/pages/Signup.tsx` submit handler | `supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })` then insert `restaurants` row |
| `src/pages/ForgotPassword.tsx` | `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })` |
| `src/pages/ResetPassword.tsx` | `supabase.auth.updateUser({ password })` |
| `src/pages/Payment.tsx` | Call `pay-with-paystack` edge function (see §5) |
| `src/pages/dashboard/Orders.tsx` | Subscribe to realtime: `supabase.channel('orders').on('postgres_changes', ...)` |
| `src/pages/dashboard/MenuManagement.tsx` add/edit/delete | `supabase.from('menu_items').insert/update/delete` |
| `src/pages/customer/QrMenu.tsx` (load by `:table`) | `supabase.from('restaurant_tables').select('*, restaurants(*), menu_items(*)').eq('qr_token', token).single()` |
| Cart submit | `supabase.from('orders').insert(...).select().single()` then bulk-insert `order_items` |
| `Call waiter` / `Complaint` buttons | `supabase.from('customer_requests').insert({ type, message })` |

### Auth setup snippet

Always set up the listener **before** calling `getSession`:

```ts
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
  supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
  return () => subscription.unsubscribe();
}, []);
```

## 4. Storage bucket for menu images

```sql
insert into storage.buckets (id, name, public) values ('menu-images', 'menu-images', true);

create policy "Public read menu images" on storage.objects
  for select using (bucket_id = 'menu-images');

create policy "Members upload menu images" on storage.objects
  for insert with check (bucket_id = 'menu-images' and auth.role() = 'authenticated');
```

## 5. Paystack integration (edge function)

Create an edge function `pay-with-paystack`:

1. Receive `{ plan, email, restaurant_id }` from `/payment` page.
2. Call Paystack `POST /transaction/initialize` with the `PAYSTACK_SECRET_KEY`
   secret (add via Cloud secrets — never put it in frontend code).
3. Return `authorization_url` to the client; redirect the user.
4. A second edge function `paystack-webhook` listens to Paystack's webhook,
   verifies the `x-paystack-signature` HMAC, then `upsert`s into
   `subscriptions` with `status='active'` and `current_period_end`.

## 6. Realtime live orders

```ts
const channel = supabase
  .channel('restaurant-orders')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
    (payload) => refetchOrders())
  .subscribe();
```

## 7. Checklist before going live

- [ ] All `mockX` imports removed from `src/`
- [ ] Email confirmation **disabled** during testing, **enabled** for prod
- [ ] Site URL + redirect URLs configured in Cloud auth settings
- [ ] `PAYSTACK_SECRET_KEY` added as a secret (NOT a public env var)
- [ ] RLS verified: open an incognito tab, try to read another restaurant's orders — must fail
- [ ] Realtime publication includes `orders`, `order_items`, `customer_requests`
- [ ] Storage bucket `menu-images` exists and is public-read
- [ ] Backups enabled in the Cloud project settings

---

_Last updated: 2026-05-04_
