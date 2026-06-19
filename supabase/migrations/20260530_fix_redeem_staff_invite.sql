-- Fix redeem_staff_invite: explicitly reference extensions schema for pgcrypto
-- so gen_salt() and crypt() work correctly in SECURITY DEFINER context.
CREATE OR REPLACE FUNCTION public.redeem_staff_invite(
  p_token text,
  p_email text,
  p_full_name text,
  p_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
declare
  v_invite staff_invites%rowtype;
  v_user_id uuid;
  v_existing auth.users%rowtype;
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

  -- Check if user already exists
  select * into v_existing from auth.users where email = lower(p_email);
  if found then
    v_user_id := v_existing.id;
  else
    -- Create new auth user with pgcrypto via extensions schema
    v_user_id := gen_random_uuid();
    insert into auth.users (
      id, email, encrypted_password, email_confirmed_at,
      raw_user_meta_data, created_at, updated_at, aud, role
    ) values (
      v_user_id,
      lower(p_email),
      extensions.crypt(p_password, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('full_name', p_full_name),
      now(), now(), 'authenticated', 'authenticated'
    );
  end if;

  -- Assign role
  insert into public.user_roles (user_id, restaurant_id, role)
  values (v_user_id, v_invite.restaurant_id, v_invite.role)
  on conflict (user_id, restaurant_id) do update set role = excluded.role;

  -- Mark invite as used
  update public.staff_invites set accepted_at = now() where id = v_invite.id;

  return json_build_object('ok', true);
end;
$$;
