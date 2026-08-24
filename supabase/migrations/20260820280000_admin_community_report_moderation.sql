-- Fila de denúncias para o painel administrativo. A listagem não usa a tabela
-- diretamente no cliente e as mudanças de status sempre registram o revisor.

create or replace function public.admin_list_community_reports(input_status text default null)
returns table (
  id uuid,
  target_type text,
  reason text,
  details text,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reporter_name text,
  target_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_admin_role('moderator') then
    raise exception 'admin_role_required';
  end if;
  if input_status is not null and input_status not in ('open', 'reviewing', 'resolved', 'dismissed') then
    raise exception 'invalid_report_status';
  end if;

  return query
  select report_item.id,
    report_item.target_type,
    report_item.reason,
    report_item.details,
    report_item.status,
    report_item.created_at,
    report_item.reviewed_at,
    reporter.full_name,
    case report_item.target_type
      when 'post' then coalesce(post_author.full_name, 'Publicação removida')
      when 'comment' then coalesce(comment_author.full_name, 'Comentário removido')
      when 'user' then coalesce(target_profile.full_name, 'Perfil removido')
    end
  from public.reports report_item
  left join public.profiles reporter on reporter.id = report_item.reporter_user_id
  left join public.posts post_item on post_item.id = report_item.post_id
  left join public.profiles post_author on post_author.id = post_item.user_id
  left join public.post_comments comment_item on comment_item.id = report_item.comment_id
  left join public.profiles comment_author on comment_author.id = comment_item.user_id
  left join public.profiles target_profile on target_profile.id = report_item.target_user_id
  where input_status is null or report_item.status = input_status
  order by case report_item.status when 'open' then 1 when 'reviewing' then 2 else 3 end, report_item.created_at asc
  limit 100;
end;
$$;

create or replace function public.admin_update_community_report_status(input_report_id uuid, input_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_admin_role('moderator') then
    raise exception 'admin_role_required';
  end if;
  if input_report_id is null or input_status not in ('reviewing', 'resolved', 'dismissed') then
    raise exception 'invalid_report_input';
  end if;

  update public.reports
  set status = input_status,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = input_report_id;

  if not found then
    raise exception 'report_not_found';
  end if;

  insert into public.admin_audit_logs(actor_user_id, action, metadata)
  values (auth.uid(), 'community_report_status_updated', jsonb_build_object('report_id', input_report_id, 'status', input_status));
end;
$$;

-- O navegador só cria denúncias próprias. A revisão passa pela função acima,
-- que força o moderador responsável e a data da ação.
drop policy if exists "Moderators update community reports" on public.reports;
revoke update on public.reports from authenticated;

revoke all on function public.admin_list_community_reports(text) from public, anon;
revoke all on function public.admin_update_community_report_status(uuid, text) from public, anon;
grant execute on function public.admin_list_community_reports(text) to authenticated;
grant execute on function public.admin_update_community_report_status(uuid, text) to authenticated;
