-- Create the get_invite_info function to verify staff invites on the frontend

CREATE OR REPLACE FUNCTION public.get_invite_info(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _inv record;
  _res record;
BEGIN
  -- Find the active invite
  SELECT * INTO _inv FROM public.staff_invites 
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > now();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'This invite link is invalid or has already been used.');
  END IF;

  -- Get the restaurant name for the UI
  SELECT name INTO _res FROM public.restaurants WHERE id = _inv.restaurant_id;

  RETURN jsonb_build_object(
    'email', _inv.email,
    'role', _inv.role,
    'restaurant_name', _res.name,
    'expires_at', _inv.expires_at
  );
END;
$$;
