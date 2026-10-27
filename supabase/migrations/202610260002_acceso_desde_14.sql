-- Product policy requested by operator: self-service youth accounts at 14–17.
-- This is not a legal conclusion. Enable only for reviewed operating jurisdictions.
begin;
update privacy_private.configuration set policy_version='2026-10-26.2';
alter table privacy_private.configuration add column teen_self_access_enabled boolean not null default false;
alter table privacy_private.accounts add column age_band text not null default 'unknown'
 check(age_band in ('unknown','under14','teen','adult'));
alter table privacy_private.accounts drop constraint accounts_age_status_check;
alter table privacy_private.accounts add constraint accounts_age_status_check
 check(age_status in ('adult_declared','teen_declared','pending_parent','parent_verified','revoked'));
update privacy_private.accounts set age_band='adult' where age_status='adult_declared';

create function privacy_private.teen_subject_allowed(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from privacy_private.accounts a cross join privacy_private.configuration c
 where a.user_id=p_user_id and a.age_status='teen_declared' and a.age_band='teen'
 and a.policy_version=c.policy_version and a.terms_at is not null and a.privacy_ack_at is not null
 and c.public_ready and c.minors_enabled and c.teen_self_access_enabled)
$$;
revoke all on function privacy_private.teen_subject_allowed(uuid) from public,anon,authenticated;
create function public.privacy_teen_access_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select privacy_private.teen_subject_allowed(auth.uid())
$$;
revoke all on function public.privacy_teen_access_allowed() from public,anon;
grant execute on function public.privacy_teen_access_allowed() to authenticated;

create function public.privacy_teen_registration_ready() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from privacy_private.configuration where public_ready and minors_enabled and teen_self_access_enabled)
$$;
revoke all on function public.privacy_teen_registration_ready() from public;
grant execute on function public.privacy_teen_registration_ready() to anon,authenticated;

create or replace function public.privacy_minor_access_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select public.privacy_teen_access_allowed() or exists(select 1 from privacy_private.accounts a cross join privacy_private.configuration c
 where a.user_id=auth.uid() and a.age_status='parent_verified' and c.public_ready and c.minors_enabled
 and a.guardian_policy_version=c.policy_version and 'private_planner'=any(a.guardian_scopes)
 and a.guardian_consent_expires_at>now())
$$;

create function public.privacy_accept_teen(p_version text,p_terms boolean,p_privacy boolean) returns void
language plpgsql security definer set search_path='' as $$
declare a privacy_private.accounts;
begin
 if auth.uid() is null or p_terms is distinct from true or p_privacy is distinct from true then
  raise exception 'Acceptance required' using errcode='42501'; end if;
 if not public.privacy_teen_registration_ready() or not exists(select 1 from privacy_private.configuration where policy_version=p_version) then
  raise exception 'Teen registration is not enabled' using errcode='42501'; end if;
 select * into a from privacy_private.accounts where user_id=auth.uid() for update;
 -- Do not reinterpret a previously known under-14 account, revocation, or legacy
 -- parental case whose exact age band was never recorded as independent consent.
 if found and (a.age_status='revoked' or a.age_band in ('under14','adult')
 or (a.age_band='unknown' and a.age_status<>'teen_declared')) then
  raise exception 'Age classification review required' using errcode='42501'; end if;
 insert into privacy_private.accounts(user_id,age_status,age_band,policy_version,terms_at,privacy_ack_at)
 values(auth.uid(),'teen_declared','teen',p_version,now(),now())
 on conflict(user_id) do update set age_status='teen_declared',age_band='teen',policy_version=p_version,
 terms_at=now(),privacy_ack_at=now(),guardian_policy_version=null,guardian_scopes='{}',guardian_consent_expires_at=null,updated_at=now()
 where privacy_private.accounts.age_status<>'revoked' and privacy_private.accounts.age_band='teen';
 if not found then raise exception 'Age classification review required' using errcode='42501'; end if;
end $$;
revoke all on function public.privacy_accept_teen(text,boolean,boolean) from public,anon;
grant execute on function public.privacy_accept_teen(text,boolean,boolean) to authenticated;

create or replace function public.privacy_accept_adult(p_version text,p_terms boolean,p_privacy boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_terms is distinct from true or p_privacy is distinct from true then raise exception 'Acceptance required' using errcode='42501'; end if;
 if not exists(select 1 from privacy_private.configuration where public_ready and policy_version=p_version) then raise exception 'Public service configuration is incomplete' using errcode='42501'; end if;
 if exists(select 1 from privacy_private.accounts where user_id=auth.uid() and age_status='teen_declared') then raise exception 'Age classification review required' using errcode='42501'; end if;
 if exists(select 1 from privacy_private.accounts where user_id=auth.uid() and (age_status<>'adult_declared' or age_band='under14')) then raise exception 'Parental review required' using errcode='42501'; end if;
 insert into privacy_private.accounts(user_id,age_status,age_band,policy_version,terms_at,privacy_ack_at)
 values(auth.uid(),'adult_declared','adult',p_version,now(),now())
 on conflict(user_id) do update set policy_version=p_version,age_band='adult',terms_at=now(),privacy_ack_at=now(),updated_at=now()
 where privacy_private.accounts.age_status='adult_declared' and privacy_private.accounts.age_band<>'under14';
 if not found then raise exception 'Age classification review required' using errcode='42501'; end if;
end $$;

create or replace function privacy_private.check_registration() returns trigger
language plpgsql security definer set search_path='' as $$
declare a privacy_private.minor_admissions; v_band text;
begin
 if new.raw_app_meta_data ? 'army_minor_admission' then
  select * into a from privacy_private.minor_admissions where ticket=(new.raw_app_meta_data->>'army_minor_admission')::uuid for update;
  if not found or a.consumed_at is not null or a.ticket_expires_at<=now() or a.consent_expires_at<=now()
  or not exists(select 1 from privacy_private.configuration where public_ready and minors_enabled and policy_version=a.policy_version) then
   raise exception 'Invalid minor admission' using errcode='42501'; end if;
  update privacy_private.minor_admissions set consumed_by=new.id,consumed_at=now() where ticket=a.ticket;
  return new;
 end if;
 v_band:=coalesce(new.raw_user_meta_data->>'age_band','');
 if not exists(select 1 from privacy_private.configuration where public_ready and policy_version=new.raw_user_meta_data->>'policy_version')
 or coalesce(new.raw_user_meta_data->>'terms_accepted','')<>'true'
 or coalesce(new.raw_user_meta_data->>'privacy_acknowledged','')<>'true'
 or v_band not in ('adult','teen') or (v_band='teen' and not public.privacy_teen_registration_ready()) then
  raise exception 'Registration is restricted pending privacy and age review' using errcode='42501'; end if;
 return new;
end $$;

create function privacy_private.record_teen_registration() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not(new.raw_app_meta_data ? 'army_minor_admission') and new.raw_user_meta_data->>'age_band'='teen' then
  insert into privacy_private.accounts(user_id,age_status,age_band,policy_version,terms_at,privacy_ack_at)
  values(new.id,'teen_declared','teen',new.raw_user_meta_data->>'policy_version',now(),now());
 end if;
 return new;
end $$;
revoke all on function privacy_private.record_teen_registration() from public,anon,authenticated;
create trigger army_record_teen_registration after insert on auth.users for each row execute function privacy_private.record_teen_registration();

create or replace function public.privacy_restrict_minor() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 insert into privacy_private.accounts(user_id,age_status,age_band,policy_version)
 values(auth.uid(),'pending_parent','under14','')
 on conflict(user_id) do update set age_status=case when privacy_private.accounts.age_status='revoked' then 'revoked' else 'pending_parent' end,
 age_band='under14',promotional_email=false,updated_at=now();
 delete from public.social_push_dispositivos where usuario_id=auth.uid();
 update public.social_perfiles set visible=false where usuario_id=auth.uid();
end $$;

create or replace function public.community_safe_participant() returns boolean
language sql stable security definer set search_path='' as $$
 select public.privacy_access_allowed() or public.privacy_teen_access_allowed() or
 (public.privacy_minor_access_allowed() and exists(select 1 from privacy_private.accounts
 where user_id=auth.uid() and age_status='parent_verified' and 'moderated_posts'=any(guardian_scopes)))
$$;
create or replace function public.community_safe_feed() returns table(id uuid,titulo text,contenido text,creado_en timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not public.community_safe_participant() then raise exception 'Access restricted' using errcode='42501'; end if;
 return query select p.id,p.titulo,p.contenido,p.creado_en from public.comunidad_revision_previa p
 where p.estado='aprobada' and (public.privacy_subject_allowed(p.autor_id) or privacy_private.teen_subject_allowed(p.autor_id)
 or exists(select 1 from privacy_private.accounts a cross join privacy_private.configuration c
 where a.user_id=p.autor_id and a.age_status='parent_verified' and a.guardian_policy_version=c.policy_version
 and a.guardian_consent_expires_at>now() and 'moderated_posts'=any(a.guardian_scopes) and c.minors_enabled))
 order by p.creado_en desc,p.id desc limit 30;
end $$;
commit;
