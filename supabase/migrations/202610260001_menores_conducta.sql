-- Limited youth space. No live enablement or automatic parental verification.
begin;
update privacy_private.configuration set policy_version='2026-10-26';
alter table privacy_private.configuration add column minors_enabled boolean not null default false;
alter table privacy_private.accounts add column guardian_policy_version text;
alter table privacy_private.accounts add column guardian_scopes text[] not null default '{}';
alter table privacy_private.accounts add column guardian_consent_expires_at timestamptz;
create table privacy_private.minor_admissions (
 ticket uuid primary key default gen_random_uuid(),
 evidence_reference text not null check(char_length(evidence_reference) between 1 and 200),
 policy_version text not null,
 scopes text[] not null,
 consent_expires_at timestamptz not null,
 ticket_expires_at timestamptz not null default now()+interval '15 minutes',
 consumed_by uuid references auth.users(id) on delete cascade deferrable initially deferred,
 consumed_at timestamptz
);
revoke all on privacy_private.minor_admissions from public,anon,authenticated;
create function public.privacy_issue_minor_admission(p_evidence_reference text,p_version text,p_scopes text[],p_expires_at timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_ticket uuid;
begin
 if not exists(select 1 from privacy_private.configuration where public_ready and minors_enabled and policy_version=p_version)
 or p_scopes is null or not ('private_planner'=any(p_scopes)) or not(p_scopes<@array['private_planner','moderated_posts']::text[])
 or p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '1 year' then raise exception 'Minor admission is not ready'; end if;
 insert into privacy_private.minor_admissions(evidence_reference,policy_version,scopes,consent_expires_at)
 values(p_evidence_reference,p_version,p_scopes,p_expires_at) returning ticket into v_ticket;
 return v_ticket;
end $$;
revoke all on function public.privacy_issue_minor_admission(text,text,text[],timestamptz) from public,anon,authenticated;
grant execute on function public.privacy_issue_minor_admission(text,text,text[],timestamptz) to service_role;
create function public.privacy_purge_minor_admissions() returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 delete from privacy_private.minor_admissions where ticket_expires_at<=now();
 get diagnostics v_count = row_count;
 return v_count;
end $$;
revoke all on function public.privacy_purge_minor_admissions() from public,anon,authenticated;
grant execute on function public.privacy_purge_minor_admissions() to service_role;

-- The admission ticket is minted only after trusted parental verification. Auth
-- Admin places it in app_metadata; it is not a checkbox or public signup flag.
create or replace function privacy_private.check_registration() returns trigger
language plpgsql security definer set search_path='' as $$
declare a privacy_private.minor_admissions;
begin
 if new.raw_app_meta_data ? 'army_minor_admission' then
  select * into a from privacy_private.minor_admissions where ticket=(new.raw_app_meta_data->>'army_minor_admission')::uuid for update;
  if not found or a.consumed_at is not null or a.ticket_expires_at<=now() or a.consent_expires_at<=now()
  or not exists(select 1 from privacy_private.configuration where public_ready and minors_enabled and policy_version=a.policy_version) then
   raise exception 'Invalid minor admission' using errcode='42501'; end if;
  update privacy_private.minor_admissions set consumed_by=new.id,consumed_at=now() where ticket=a.ticket;
  return new;
 end if;
 if not exists(select 1 from privacy_private.configuration where public_ready and policy_version=new.raw_user_meta_data->>'policy_version')
 or coalesce(new.raw_user_meta_data->>'age_band','')<>'adult' or coalesce(new.raw_user_meta_data->>'terms_accepted','')<>'true'
 or coalesce(new.raw_user_meta_data->>'privacy_acknowledged','')<>'true' then
  raise exception 'Registration is restricted pending privacy and age review' using errcode='42501';
 end if;
 return new;
end $$;
create function privacy_private.complete_minor_admission() returns trigger
language plpgsql security definer set search_path='' as $$
declare a privacy_private.minor_admissions;
begin
 if new.raw_app_meta_data ? 'army_minor_admission' then
  select * into strict a from privacy_private.minor_admissions where ticket=(new.raw_app_meta_data->>'army_minor_admission')::uuid and consumed_by=new.id;
  insert into privacy_private.accounts(user_id,age_status,policy_version,guardian_policy_version,guardian_scopes,guardian_consent_expires_at)
  values(new.id,'parent_verified','',a.policy_version,a.scopes,a.consent_expires_at);
  insert into privacy_private.parental_events(event_id,user_id,decision,evidence_reference)
  values('admission:'||a.ticket,new.id,'verified',a.evidence_reference);
 end if;
 return new;
end $$;
revoke all on function privacy_private.complete_minor_admission() from public,anon,authenticated;
create trigger army_complete_minor_admission after insert on auth.users for each row execute function privacy_private.complete_minor_admission();

create function public.privacy_minor_access_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from privacy_private.accounts a cross join privacy_private.configuration c
 where a.user_id=auth.uid() and a.age_status='parent_verified' and c.public_ready and c.minors_enabled
 and a.guardian_policy_version=c.policy_version and 'private_planner'=any(a.guardian_scopes)
 and a.guardian_consent_expires_at>now())
$$;
revoke all on function public.privacy_minor_access_allowed() from public,anon;
grant execute on function public.privacy_minor_access_allowed() to authenticated;

create function public.privacy_access_mode() returns text
language sql stable security definer set search_path='' as $$
 select case when public.privacy_access_allowed() then 'adult'
 when public.privacy_minor_access_allowed() then 'minor_limited' else 'restricted' end
$$;
revoke all on function public.privacy_access_mode() from public,anon;
grant execute on function public.privacy_access_mode() to authenticated;

-- Called only by a trusted verifier/server after actual identity and responsibility
-- checks. A signed delivery alone does not establish that those checks happened.
create function public.privacy_parental_authorize(p_event_id text,p_user_id uuid,p_evidence_reference text,p_version text,p_scopes text[],p_expires_at timestamptz) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_version is null or not exists(select 1 from privacy_private.configuration where policy_version=p_version)
 or p_scopes is null or not ('private_planner'=any(p_scopes))
 or not(p_scopes<@array['private_planner','moderated_posts']::text[])
 or p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '1 year' then
  raise exception 'Invalid parental scope, version or expiry' using errcode='22023';
 end if;
 perform public.privacy_parental_event(p_event_id,p_user_id,'verified',p_evidence_reference);
 update privacy_private.accounts set guardian_policy_version=p_version,guardian_scopes=p_scopes,
 guardian_consent_expires_at=p_expires_at where user_id=p_user_id;
end $$;
revoke all on function public.privacy_parental_authorize(text,uuid,text,text,text[],timestamptz) from public,anon,authenticated;
grant execute on function public.privacy_parental_authorize(text,uuid,text,text,text[],timestamptz) to service_role;

create table public.comunidad_revision_previa (
 id uuid primary key default gen_random_uuid(),
 autor_id uuid not null references auth.users(id) on delete cascade,
 titulo text not null check(char_length(btrim(titulo)) between 3 and 120),
 contenido text not null check(char_length(btrim(contenido)) between 10 and 2000),
 conducta_version text not null,
 estado text not null default 'pendiente' check(estado in ('pendiente','aprobada','rechazada')),
 senales text[] not null default '{}',
 creado_en timestamptz not null default now(),
 revisado_en timestamptz,
 revisor_id uuid references auth.users(id) on delete set null,
 nota_revision text
);
create index comunidad_previa_autor on public.comunidad_revision_previa(autor_id,creado_en desc);
create index comunidad_previa_estado on public.comunidad_revision_previa(estado,creado_en,id);
create table privacy_private.conduct_reviews (
 id uuid primary key default gen_random_uuid(),
 publicacion_id uuid not null references public.comunidad_revision_previa(id) on delete cascade,
 revisor_id uuid references auth.users(id) on delete set null,
 estado_anterior text not null,
 estado_nuevo text not null,
 motivo text not null,
 creado_en timestamptz not null default now()
);
create table privacy_private.safe_reports (
 publicacion_id uuid not null references public.comunidad_revision_previa(id) on delete cascade,
 denunciante_id uuid not null references auth.users(id) on delete cascade,
 motivo text not null check(motivo in ('privacidad','acoso','sexual','otro')),
 creado_en timestamptz not null default now(),
 primary key(publicacion_id,denunciante_id)
);
revoke all on privacy_private.safe_reports from public,anon,authenticated;
revoke all on public.comunidad_revision_previa from public,anon,authenticated;
revoke all on privacy_private.conduct_reviews from public,anon,authenticated;
alter table public.comunidad_revision_previa enable row level security;
grant select(id,titulo,contenido,estado,creado_en,nota_revision) on public.comunidad_revision_previa to authenticated;
create policy previa_propias on public.comunidad_revision_previa for select to authenticated
 using(autor_id=auth.uid() and (public.privacy_access_allowed() or public.privacy_minor_access_allowed()));

create function public.community_safety_signals(p_text text) returns text[]
language sql immutable set search_path='' as $$
 select array_remove(array[
 case when translate(lower(p_text),'áéíóúüñ','aeiouun') ~ '(idiota|imbecil|estupido|stupid|idiot|fuck|mierda|porra|くそ|씨발)' then 'lenguaje_a_revisar' end,
 case when p_text ~* '(https?://|www[.]|[[:alnum:]_.%+-]+@[[:alnum:].-]+[.][[:alpha:]]{2,}|@[[:alnum:]_]{2,}|[+]?[0-9][0-9 ()-]{6,}[0-9])' then 'contacto_o_enlace' end
 ],null)
$$;
revoke all on function public.community_safety_signals(text) from public,anon,authenticated;

create function public.community_safe_participant() returns boolean
language sql stable security definer set search_path='' as $$
 select public.privacy_access_allowed() or (public.privacy_minor_access_allowed() and exists(
 select 1 from privacy_private.accounts where user_id=auth.uid() and 'moderated_posts'=any(guardian_scopes)))
$$;
revoke all on function public.community_safe_participant() from public,anon;
grant execute on function public.community_safe_participant() to authenticated;

create function public.community_submit_safe(p_titulo text,p_contenido text,p_conducta_version text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_senales text[];
begin
 if not public.community_safe_participant() then raise exception 'Access restricted' using errcode='42501'; end if;
 if p_conducta_version is distinct from '2026-10-26' then raise exception 'Conduct acceptance required' using errcode='22023'; end if;
 -- Serialize submissions per account to enforce the limit under concurrent calls.
 perform 1 from privacy_private.accounts where user_id=auth.uid() for update;
 if (select count(*) from public.comunidad_revision_previa where autor_id=auth.uid() and creado_en>now()-interval '1 day')>=5 then
  raise exception 'Daily submission limit reached' using errcode='22023';
 end if;
 v_senales:=public.community_safety_signals(coalesce(p_titulo,'')||' '||coalesce(p_contenido,''));
 if 'contacto_o_enlace'=any(v_senales) then raise exception 'Do not include contact details or links' using errcode='22023'; end if;
 insert into public.comunidad_revision_previa(autor_id,titulo,contenido,conducta_version,senales)
 values(auth.uid(),btrim(p_titulo),btrim(p_contenido),p_conducta_version,v_senales) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.community_submit_safe(text,text,text) from public,anon;
grant execute on function public.community_submit_safe(text,text,text) to authenticated;

create function public.community_safe_feed() returns table(id uuid,titulo text,contenido text,creado_en timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not public.community_safe_participant() then raise exception 'Access restricted' using errcode='42501'; end if;
 return query select p.id,p.titulo,p.contenido,p.creado_en from public.comunidad_revision_previa p
 where p.estado='aprobada' and (public.privacy_subject_allowed(p.autor_id) or exists(
 select 1 from privacy_private.accounts a cross join privacy_private.configuration c
 where a.user_id=p.autor_id and a.age_status='parent_verified' and a.guardian_policy_version=c.policy_version
 and a.guardian_consent_expires_at>now() and 'moderated_posts'=any(a.guardian_scopes) and c.minors_enabled))
 order by p.creado_en desc,p.id desc limit 30;
end $$;
revoke all on function public.community_safe_feed() from public,anon;
grant execute on function public.community_safe_feed() to authenticated;

create function public.community_review_queue(p_estado text default 'pendiente') returns setof public.comunidad_revision_previa
language plpgsql security definer set search_path='' as $$
begin
 if not public.privacy_access_allowed() or not public.es_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 if p_estado not in ('pendiente','aprobada','rechazada','reportada') or p_estado is null then raise exception 'Invalid state'; end if;
 return query select p.* from public.comunidad_revision_previa p where p.estado=p_estado or
 (p_estado='reportada' and p.estado='aprobada' and exists(select 1 from privacy_private.safe_reports r where r.publicacion_id=p.id)) order by p.creado_en,p.id limit 50;
end $$;
revoke all on function public.community_review_queue(text) from public,anon;
grant execute on function public.community_review_queue(text) to authenticated;

create function public.community_review_safe(p_id uuid,p_aprobar boolean,p_nota text) returns void
language plpgsql security definer set search_path='' as $$
declare p public.comunidad_revision_previa; v_estado text;
begin
 if not public.privacy_access_allowed() or not public.es_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 if p_aprobar is null or p_nota is null or char_length(btrim(p_nota)) not between 5 and 500 then raise exception 'Review reason required'; end if;
 select * into p from public.comunidad_revision_previa where id=p_id for update;
 if not found or p.autor_id=auth.uid() then raise exception 'Independent review required' using errcode='42501'; end if;
 v_estado:=case when p_aprobar then 'aprobada' else 'rechazada' end;
 if p.estado=v_estado then raise exception 'Already reviewed'; end if;
 update public.comunidad_revision_previa set estado=v_estado,revisor_id=auth.uid(),revisado_en=now(),nota_revision=btrim(p_nota) where id=p_id;
 insert into privacy_private.conduct_reviews(publicacion_id,revisor_id,estado_anterior,estado_nuevo,motivo)
 values(p_id,auth.uid(),p.estado,v_estado,btrim(p_nota));
end $$;
revoke all on function public.community_review_safe(uuid,boolean,text) from public,anon;
grant execute on function public.community_review_safe(uuid,boolean,text) to authenticated;

create function public.community_report_safe(p_id uuid,p_motivo text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.community_safe_participant() then raise exception 'Access restricted' using errcode='42501'; end if;
 if p_motivo is null or p_motivo not in ('privacidad','acoso','sexual','otro') then raise exception 'Invalid report category'; end if;
 if not exists(select 1 from public.comunidad_revision_previa where id=p_id and estado='aprobada') then raise exception 'Publication unavailable'; end if;
 insert into privacy_private.safe_reports(publicacion_id,denunciante_id,motivo) values(p_id,auth.uid(),p_motivo) on conflict do nothing;
end $$;
revoke all on function public.community_report_safe(uuid,text) from public,anon;
grant execute on function public.community_report_safe(uuid,text) to authenticated;
create function public.community_report_summary(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_summary jsonb;
begin
 if not public.privacy_access_allowed() or not public.es_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 select coalesce(jsonb_object_agg(q.motivo,q.total),'{}'::jsonb) into v_summary from
 (select motivo,count(*) as total from privacy_private.safe_reports where publicacion_id=p_id group by motivo) q;
 return v_summary;
end $$;
revoke all on function public.community_report_summary(uuid) from public,anon;
grant execute on function public.community_report_summary(uuid) to authenticated;
commit;
