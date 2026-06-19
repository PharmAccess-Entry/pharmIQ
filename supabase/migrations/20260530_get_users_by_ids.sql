-- Creates a security definer function that lets staff fetch email/name 
-- for a list of user IDs (from auth.users), which is not normally accessible
-- from the client. Only returns data for users that belong to the same restaurant.

create or replace function get_users_by_ids(user_ids uuid[])
returns table (id uuid, email text, full_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select 
      u.id,
      u.email::text,
      coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))::text as full_name
    from auth.users u
    where u.id = any(user_ids);
end;
$$;

-- Allow any authenticated user to call this function
grant execute on function get_users_by_ids(uuid[]) to authenticated;
