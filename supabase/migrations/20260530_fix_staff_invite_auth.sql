-- Fix: Simplify redeem_staff_invite to only assign roles.
-- Password/user creation is now handled by supabase.auth.signUp() on the frontend,
-- which ensures Supabase's internal password hashing is used correctly.
-- The RPC now only runs AFTER the user is authenticated (auth.uid() is set).
CREATE OR REPLACE FUNCTION public.redeem_staff_invite(
  p_token text,
  p_email text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
declare
  v_invite staff_invites%rowtype;
  v_user_id uuid;
begin
  -- Validate invite
  select * into v_invite from public.staff_invites
  where token = p_token and accepted_at is null and expires_at > now();
  if not found then
    return json_build_object('error', 'Invite link is invalid or has expired.');
  end if;

  -- Validate email match
  if lower(v_invite.email) != lower(p_email) then
    return json_build_object('error', 'Email does not match the invite.');
  end if;

  -- Get the authenticated user's ID (frontend calls supabase.auth.signUp first)
  v_user_id := auth.uid();
  if v_user_id is null then
    return json_build_object('error', 'You must be signed in to redeem an invite.');
  end if;

  -- Assign role to the restaurant
  insert into public.user_roles (user_id, restaurant_id, role)
  values (v_user_id, v_invite.restaurant_id, v_invite.role)
  on conflict (user_id, restaurant_id) do update set role = excluded.role;

  -- Mark invite as used
  update public.staff_invites set accepted_at = now() where id = v_invite.id;

  return json_build_object('ok', true, 'restaurant_id', v_invite.restaurant_id, 'role', v_invite.role);
end;
$$;
