create or replace function public.admin_list_audit_history(input_days integer default 30, input_action text default null)
returns table(created_at timestamptz, action text, actor_name text, target_user_id uuid, metadata jsonb)
language sql stable security definer set search_path = public
as $$
 select log.created_at,log.action,profile.full_name,log.target_user_id,log.metadata from public.admin_audit_logs log
 left join public.profiles profile on profile.id=log.actor_user_id
 where public.has_admin_role('admin') and (input_days=0 or log.created_at >= now()-make_interval(days=>input_days)) and (input_action is null or input_action='' or log.action=input_action)
 order by log.created_at desc limit 1000
$$;
grant execute on function public.admin_list_audit_history(integer,text) to authenticated;
