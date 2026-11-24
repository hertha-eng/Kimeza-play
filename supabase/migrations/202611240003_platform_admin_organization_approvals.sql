-- Platform administration: secure approval workflow and admin read access.
create policy "Platform admins can view all districts"
on public.districts for select to authenticated
using (private.is_platform_admin((select auth.uid())));

create policy "Platform admins can view all zones"
on public.zones for select to authenticated
using (private.is_platform_admin((select auth.uid())));

create policy "Platform admins can view all clubs"
on public.clubs for select to authenticated
using (private.is_platform_admin((select auth.uid())));

create policy "Platform admins can view member profiles"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or private.is_platform_admin((select auth.uid())));

create or replace function private.review_organization(
  p_entity_type text, p_entity_id uuid, p_approve boolean
)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_status text; v_parent_status text;
begin
  if auth.uid() is null or not private.is_platform_admin(auth.uid()) then
    raise exception 'Only platform administrators can review organisations';
  end if;
  if p_entity_type = 'district' then
    update public.districts set status = case when p_approve then 'approved'::public.org_status else 'rejected'::public.org_status end
    where id = p_entity_id and status = 'pending' returning status::text into v_status;
  elsif p_entity_type = 'zone' then
    if p_approve then
      select d.status::text into v_parent_status from public.zones z join public.districts d on d.id=z.district_id where z.id=p_entity_id;
      if v_parent_status is distinct from 'approved' then raise exception 'Approve the parent district before approving this zone'; end if;
    end if;
    update public.zones set status = case when p_approve then 'approved'::public.org_status else 'rejected'::public.org_status end
    where id = p_entity_id and status = 'pending' returning status::text into v_status;
  elsif p_entity_type = 'club' then
    if p_approve then
      select z.status::text into v_parent_status from public.clubs c join public.zones z on z.id=c.zone_id where c.id=p_entity_id;
      if v_parent_status is distinct from 'approved' then raise exception 'Approve the parent zone before approving this club'; end if;
    end if;
    update public.clubs set status = case when p_approve then 'approved'::public.org_status else 'rejected'::public.org_status end
    where id = p_entity_id and status = 'pending' returning status::text into v_status;
  else
    raise exception 'Unsupported organisation type';
  end if;
  if v_status is null then raise exception 'Pending organisation not found'; end if;
  return v_status;
end;
$$;
revoke all on function private.review_organization(text, uuid, boolean) from public, anon;
grant execute on function private.review_organization(text, uuid, boolean) to authenticated;

create or replace function public.review_organization(
  p_entity_type text, p_entity_id uuid, p_approve boolean
)
returns text language sql security invoker set search_path = ''
as $$ select private.review_organization(p_entity_type, p_entity_id, p_approve); $$;
revoke all on function public.review_organization(text, uuid, boolean) from public, anon;
grant execute on function public.review_organization(text, uuid, boolean) to authenticated;
