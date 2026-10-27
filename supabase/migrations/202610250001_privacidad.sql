-- Review on a disposable database before deployment. Never run a blanket db push.
-- Defaults fail closed. No payments are enabled. Existing rows/consents are not rewritten.
begin;
create schema if not exists privacy_private;
revoke all on schema privacy_private from public, anon, authenticated;

create table privacy_private.configuration (
  singleton boolean primary key default true check(singleton),
  public_ready boolean not null default false,
  deletion_reviewed boolean not null default false,
  policy_version text not null default '2026-10-25'
);
insert into privacy_private.configuration(singleton) values(true);
create table privacy_private.accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age_status text not null check(age_status in ('adult_declared','pending_parent','parent_verified','revoked')),
  policy_version text not null,
  terms_at timestamptz,
  privacy_ack_at timestamptz,
  promotional_email boolean not null default false,
  unsubscribed_at timestamptz,
  updated_at timestamptz not null default now()
);
create table privacy_private.parental_events (
  event_id text primary key check(length(event_id) between 1 and 160),
  user_id uuid not null references auth.users(id) on delete cascade,
  decision text not null check(decision in ('verified','revoked')),
  evidence_reference text not null check(length(evidence_reference) between 1 and 200),
  received_at timestamptz not null default now()
);
create table privacy_private.email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  promotional_email boolean not null default false check(not promotional_email),
  unsubscribed_at timestamptz not null default now()
);
-- No direct client writes or reads, even with manipulated user_metadata.
revoke all on all tables in schema privacy_private from public, anon, authenticated;
grant usage on schema privacy_private to service_role;
grant all on all tables in schema privacy_private to service_role;

create function public.privacy_access_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from privacy_private.accounts a cross join privacy_private.configuration c
 where a.user_id=auth.uid() and a.age_status='adult_declared'
 and a.policy_version=c.policy_version and c.public_ready)
$$;
revoke all on function public.privacy_access_allowed() from public,anon;
grant execute on function public.privacy_access_allowed() to authenticated;

create function public.privacy_registration_ready() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from privacy_private.configuration where public_ready)
$$;
revoke all on function public.privacy_registration_ready() from public;
grant execute on function public.privacy_registration_ready() to anon,authenticated;

create function public.privacy_subject_allowed(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from privacy_private.accounts a cross join privacy_private.configuration c
 where a.user_id=p_user_id and a.age_status='adult_declared' and a.policy_version=c.policy_version and c.public_ready)
$$;
revoke all on function public.privacy_subject_allowed(uuid) from public,anon;
grant execute on function public.privacy_subject_allowed(uuid) to authenticated,service_role;

alter table public.social_perfiles add column visibility_consent_version text;
alter table public.social_perfiles add column visibility_consent_at timestamptz;
grant insert(visibility_consent_version),update(visibility_consent_version) on public.social_perfiles to authenticated;
create function public.privacy_profile_visible(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.privacy_subject_allowed(p_user_id) and exists(select 1 from public.social_perfiles p
 cross join privacy_private.configuration c where p.usuario_id=p_user_id and p.visible
 and p.visibility_consent_version=c.policy_version and p.visibility_consent_at is not null)
$$;
revoke all on function public.privacy_profile_visible(uuid) from public,anon;
grant execute on function public.privacy_profile_visible(uuid) to authenticated,service_role;
create function privacy_private.check_social_visibility() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.visible then
  if not public.privacy_access_allowed() or not exists(select 1 from privacy_private.configuration where policy_version=new.visibility_consent_version) then
   raise exception 'Explicit profile visibility consent required' using errcode='42501';
  end if;
  new.visibility_consent_at:=now();
 else new.visibility_consent_at:=null; new.visibility_consent_version:=null;
 end if;
 return new;
end $$;
revoke all on function privacy_private.check_social_visibility() from public,anon,authenticated;
create trigger army_social_visibility before insert or update on public.social_perfiles for each row execute function privacy_private.check_social_visibility();

create function public.privacy_accept_adult(p_version text,p_terms boolean,p_privacy boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_terms is distinct from true or p_privacy is distinct from true then
  raise exception 'Acceptance required' using errcode='42501';
 end if;
 if not exists(select 1 from privacy_private.configuration where public_ready and policy_version=p_version) then
  raise exception 'Public service configuration is incomplete' using errcode='42501';
 end if;
 -- A previously known minor cannot self-upgrade by changing metadata or calling this RPC.
 if exists(select 1 from privacy_private.accounts where user_id=auth.uid() and age_status<>'adult_declared') then
  raise exception 'Parental review required' using errcode='42501';
 end if;
 insert into privacy_private.accounts(user_id,age_status,policy_version,terms_at,privacy_ack_at)
 values(auth.uid(),'adult_declared',p_version,now(),now())
 on conflict(user_id) do update set policy_version=excluded.policy_version,terms_at=now(),privacy_ack_at=now(),updated_at=now();
end $$;
revoke all on function public.privacy_accept_adult(text,boolean,boolean) from public,anon;
grant execute on function public.privacy_accept_adult(text,boolean,boolean) to authenticated;

-- BEFORE INSERT prevents bypass through Auth REST or OAuth. New OAuth registrations
-- have no reviewed age path and are refused. Disable OAuth in the dashboard as well.
create function privacy_private.check_registration() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from privacy_private.configuration where public_ready
   and policy_version=new.raw_user_meta_data->>'policy_version')
   or coalesce(new.raw_user_meta_data->>'age_band','')<>'adult'
   or coalesce(new.raw_user_meta_data->>'terms_accepted','')<>'true'
   or coalesce(new.raw_user_meta_data->>'privacy_acknowledged','')<>'true' then
  raise exception 'Registration is restricted pending privacy and age review' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function privacy_private.check_registration() from public,anon,authenticated;
create trigger army_privacy_registration before insert on auth.users for each row execute function privacy_private.check_registration();

-- Registering a known minor is a trusted operator/provider task, never an RPC from
-- the browser. Parent verification does NOT open social access in this release.
create function public.privacy_parental_event(p_event_id text,p_user_id uuid,p_decision text,p_evidence_reference text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_decision not in ('verified','revoked') or p_decision is null then raise exception 'Invalid decision'; end if;
 perform 1 from privacy_private.accounts where user_id=p_user_id for update;
 if p_decision='verified' and exists(select 1 from privacy_private.accounts where user_id=p_user_id and age_status='revoked') then raise exception 'A revoked case requires a new reviewed parental process'; end if;
 if not exists(select 1 from privacy_private.accounts where user_id=p_user_id and age_status in ('pending_parent','parent_verified','revoked')) then raise exception 'No parental case'; end if;
 insert into privacy_private.parental_events(event_id,user_id,decision,evidence_reference)
 values(p_event_id,p_user_id,p_decision,p_evidence_reference);
 update privacy_private.accounts set age_status=case when p_decision='verified' then 'parent_verified' else 'revoked' end,
 promotional_email=false,updated_at=now() where user_id=p_user_id;
 delete from public.social_push_dispositivos where usuario_id=p_user_id;
 update public.social_perfiles set visible=false where usuario_id=p_user_id;
end $$;
revoke all on function public.privacy_parental_event(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.privacy_parental_event(text,uuid,text,text) to service_role;

create function public.privacy_unsubscribe(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 insert into privacy_private.email_preferences(user_id) values(p_user_id)
 on conflict(user_id) do update set promotional_email=false,unsubscribed_at=now();
 update privacy_private.accounts set promotional_email=false,unsubscribed_at=now(),updated_at=now() where user_id=p_user_id;
end $$;
revoke all on function public.privacy_unsubscribe(uuid) from public,anon,authenticated;
grant execute on function public.privacy_unsubscribe(uuid) to service_role;

create function public.privacy_restrict_minor() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 insert into privacy_private.accounts(user_id,age_status,policy_version,terms_at,privacy_ack_at)
 values(auth.uid(),'pending_parent','',null,null)
 on conflict(user_id) do update set age_status=case when privacy_private.accounts.age_status='revoked' then 'revoked' else 'pending_parent' end,promotional_email=false,updated_at=now();
 delete from public.social_push_dispositivos where usuario_id=auth.uid();
 update public.social_perfiles set visible=false where usuario_id=auth.uid();
end $$;
revoke all on function public.privacy_restrict_minor() from public,anon;
grant execute on function public.privacy_restrict_minor() to authenticated;

-- Necessary: restrictive policies combine with (do not replace) existing ownership
-- policies. They also cover any legacy public tables absent from repository SQL.
do $$ declare r record; begin
 for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','p') loop
  execute format('alter table public.%I enable row level security',r.relname);
  execute format('create policy army_privacy_access on public.%I as restrictive for all to authenticated using ((select public.privacy_access_allowed())) with check ((select public.privacy_access_allowed()))',r.relname);
  execute format('create policy army_privacy_anonymous on public.%I as restrictive for all to anon using (false) with check (false)',r.relname);
  -- Anonymous data access is intentionally unavailable for this authenticated app.
  execute format('revoke all on table public.%I from anon',r.relname);
 end loop;
end $$;
create policy army_privacy_storage on storage.objects as restrictive for all to authenticated
 using((select public.privacy_access_allowed())) with check((select public.privacy_access_allowed()));
-- Existing owner-executed views can bypass RLS. Ordinary views use the caller's
-- RLS; materialized views must remain unavailable until separately reviewed.
do $$ declare r record; begin
 for r in select c.relname,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('v','m') loop
  if r.relkind='v' then execute format('alter view public.%I set (security_invoker=true)',r.relname);
  else execute format('revoke all on public.%I from public,anon,authenticated',r.relname); end if;
 end loop;
end $$;
alter table public.social_perfiles alter column visible set default false;
create policy army_privacy_profile_subject on public.social_perfiles as restrictive for select to authenticated
 using(usuario_id=(select auth.uid()) or public.privacy_profile_visible(usuario_id));
create policy army_privacy_post_subject on public.comunidad_publicaciones as restrictive for select to authenticated
 using(autor_id=(select auth.uid()) or public.privacy_subject_allowed(autor_id) or (select public.es_admin()));
create policy army_privacy_comment_subject on public.comunidad_comentarios as restrictive for select to authenticated
 using(autor_id=(select auth.uid()) or public.privacy_subject_allowed(autor_id) or (select public.es_admin()));
create policy army_privacy_project_subject on public.proyectos as restrictive for select to authenticated
 using(autor_id=(select auth.uid()) or public.privacy_subject_allowed(autor_id) or (select public.es_admin()));
create policy army_privacy_private_profile on public.perfiles as restrictive for select to authenticated
 using(id=(select auth.uid()) or (select public.es_admin()));

-- SECURITY DEFINER bypasses table RLS. Gate each existing browser RPC at its entry.
-- Preserve its complete body, grants and existing ownership/admin checks. Abort
-- migration if a reviewed RPC uses a different language (requires manual review).
do $$ declare r record; definition text; newbody text; begin
 for r in select p.oid,p.proname,p.prosrc,l.lanname from pg_proc p
 join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
 where n.nspname='public' and p.prorettype<>'trigger'::regtype and
 (p.proname=any(array[
 'publicar_propuesta','revisar_solicitud','social_perfil','social_interactuar',
 'social_registrar_donacion','social_registrar_suscripcion','social_listar_conexiones',
 'social_guardar_push','comunidad_reportar','comunidad_listar_reportes','comunidad_revisar_reporte'])
 or (p.prosecdef and has_function_privilege('authenticated',p.oid,'EXECUTE')
     and p.proname not in ('es_admin','social_eliminar_push') and p.proname not like 'privacy_%'
     and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e'))) loop
  if r.lanname<>'plpgsql' or r.prosrc !~* '\mBEGIN\M' then raise exception 'RPC needs manual privacy review: %',r.proname; end if;
  definition:=pg_get_functiondef(r.oid);
  newbody:=regexp_replace(r.prosrc,'\mBEGIN\M',E'BEGIN\n IF NOT public.privacy_access_allowed() THEN RAISE EXCEPTION ''Access restricted'' USING ERRCODE=''42501''; END IF;','i');
  if r.proname='social_interactuar' then
   newbody:=regexp_replace(newbody,'\mBEGIN\M',E'BEGIN\n IF p_activo AND NOT public.privacy_profile_visible(p_perfil_id) THEN RAISE EXCEPTION ''Profile unavailable'' USING ERRCODE=''42501''; END IF;','i');
  end if;
  execute replace(definition,r.prosrc,newbody);
 end loop;
end $$;
-- social_eliminar_push intentionally remains usable before onboarding/revocation.
-- es_admin returns only a boolean and retains its existing checks.
-- Replace the two SECURITY DEFINER readers explicitly to apply target visibility,
-- not only caller authorization. Preserve pagination and administrative counters.
create or replace function public.social_perfil(p_usuario_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.social_perfiles;
begin
 if not public.privacy_access_allowed() then raise exception 'Access restricted' using errcode='42501'; end if;
 if p_usuario_id<>auth.uid() and not public.privacy_profile_visible(p_usuario_id) then return null; end if;
 select * into p from public.social_perfiles where usuario_id=p_usuario_id;
 if not found then return null; end if;
 return jsonb_build_object('usuario_id',p.usuario_id,'nombre',p.nombre,'biografia',p.biografia,'visible',public.privacy_profile_visible(p.usuario_id),
 'seguidores',(select count(*) from public.social_seguimientos where seguido_id=p.usuario_id),
 'siguiendo',(select count(*) from public.social_seguimientos where seguidor_id=p.usuario_id),
 'suscripciones',(select count(*) from public.social_suscripciones where perfil_id=p.usuario_id and referencia is not null and vigente_hasta>now()),
 'donaciones',(select count(*) from public.social_donaciones where perfil_id=p.usuario_id),
 'lo_sigo',exists(select 1 from public.social_seguimientos where seguidor_id=auth.uid() and seguido_id=p.usuario_id));
end $$;
create or replace function public.social_listar_conexiones(p_usuario_id uuid,p_tipo text,p_pagina integer default 0)
returns table(usuario_id uuid,nombre text,puede_abrir boolean,lo_sigo boolean)
language plpgsql security definer set search_path='' as $$
begin
 if not public.privacy_access_allowed() then raise exception 'Access restricted' using errcode='42501'; end if;
 if p_usuario_id is null or p_tipo is null or p_tipo not in ('seguidores','siguiendo') or p_pagina is null or p_pagina not between 0 and 10000 then raise exception 'Invalid filter'; end if;
 if p_usuario_id<>auth.uid() and not public.privacy_profile_visible(p_usuario_id) then return; end if;
 return query select q.persona,
 case when public.privacy_profile_visible(q.persona) or q.persona=auth.uid() then coalesce(p.nombre,'Mi perfil') else 'Perfil no visible' end,
 public.privacy_profile_visible(q.persona) or (q.persona=auth.uid() and p.usuario_id is not null),
 exists(select 1 from public.social_seguimientos m where m.seguidor_id=auth.uid() and m.seguido_id=q.persona)
 from (select case when p_tipo='seguidores' then s.seguidor_id else s.seguido_id end as persona from public.social_seguimientos s
 where (p_tipo='seguidores' and s.seguido_id=p_usuario_id) or (p_tipo='siguiendo' and s.seguidor_id=p_usuario_id)) q
 left join public.social_perfiles p on p.usuario_id=q.persona
 where public.privacy_profile_visible(q.persona) or q.persona=auth.uid() or (p_tipo='siguiendo' and p_usuario_id=auth.uid())
 order by case when public.privacy_profile_visible(q.persona) or q.persona=auth.uid() then lower(p.nombre) else 'perfil no visible' end,q.persona
 limit 21 offset p_pagina*20;
end $$;
create function public.privacy_push_recipient_allowed(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from privacy_private.accounts a cross join privacy_private.configuration c
 where a.user_id=p_user_id and a.age_status='adult_declared' and a.policy_version=c.policy_version and c.public_ready)
$$;
revoke all on function public.privacy_push_recipient_allowed(uuid) from public,anon,authenticated;
grant execute on function public.privacy_push_recipient_allowed(uuid) to service_role;

-- Preflight for Auth Admin deletion. No public data is removed by this check.
-- Auth Admin deletion provides transactional FK cascades; unknown/unsafe schemas
-- are refused rather than reporting successful partial erasure.
create function public.privacy_deletion_preflight(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare t text; col text; relation regclass; foreign_ok boolean;
begin
 if not exists(select 1 from privacy_private.configuration where deletion_reviewed) then
  raise exception 'Deletion inventory has not been reviewed';
 end if;
 if exists(select 1 from storage.objects where owner_id=p_user_id::text) then
  raise exception 'Storage cleanup required before deletion';
 end if;
 for t,col in select * from (values ('perfiles','id'),('viajes','usuario_id'),('proyectos','autor_id'),('solicitudes_organizadora','usuario_id')) v(t,col) loop
  relation:=to_regclass('public.'||t);
  if relation is null then raise exception 'Required table missing: %',t; end if;
  select exists(select 1 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
   where c.contype='f' and c.conrelid=relation and a.attname=col and c.confdeltype='c'
   and c.confrelid in ('auth.users'::regclass,'public.perfiles'::regclass)) into foreign_ok;
  if not foreign_ok then raise exception 'Ownership cascade not reviewed for %',t; end if;
 end loop;
end $$;
revoke all on function public.privacy_deletion_preflight(uuid) from public,anon,authenticated;
grant execute on function public.privacy_deletion_preflight(uuid) to service_role;
commit;
