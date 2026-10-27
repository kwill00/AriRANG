begin;
-- No se convierte ninguna suscripción gratuita en una paga.
alter table public.social_suscripciones add column referencia text unique;
alter table public.social_suscripciones add column vigente_hasta timestamptz;
alter table public.social_suscripciones add column verificador_id uuid references auth.users(id) on delete set null;
create or replace function public.social_interactuar(p_perfil_id uuid,p_tipo text,p_activo boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid()=p_perfil_id then raise exception 'Interacción inválida' using errcode='42501'; end if;
 if p_tipo is distinct from 'seguir' or p_activo is null then raise exception 'Solo se permite seguir o dejar de seguir' using errcode='22023'; end if;
 if p_activo then
  perform 1 from public.social_perfiles where usuario_id=p_perfil_id and visible for share;
  if not found then raise exception 'Perfil no disponible' using errcode='42501'; end if;
  insert into public.social_seguimientos values(auth.uid(),p_perfil_id) on conflict do nothing;
 else delete from public.social_seguimientos where seguidor_id=auth.uid() and seguido_id=p_perfil_id; end if;
end $$;
create function public.social_registrar_suscripcion(p_usuario_id uuid,p_perfil_id uuid,p_referencia text,p_vigente_hasta timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'Solo administración' using errcode='42501'; end if;
 if p_referencia is null or char_length(btrim(p_referencia)) not between 5 and 150 or p_vigente_hasta is null or p_vigente_hasta<=now() then raise exception 'Referencia o vigencia inválida' using errcode='22023'; end if;
 insert into public.social_suscripciones(usuario_id,perfil_id,referencia,vigente_hasta,verificador_id) values(p_usuario_id,p_perfil_id,btrim(p_referencia),p_vigente_hasta,auth.uid())
 on conflict(usuario_id,perfil_id) do update set referencia=excluded.referencia,vigente_hasta=excluded.vigente_hasta,verificador_id=excluded.verificador_id;
end $$;
create or replace function public.social_perfil(p_usuario_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.social_perfiles;
begin
 if auth.uid() is null then raise exception 'Iniciá sesión' using errcode='42501'; end if;
 select * into p from public.social_perfiles where usuario_id=p_usuario_id and (visible or usuario_id=auth.uid());
 if not found then return null; end if;
 return jsonb_build_object('usuario_id',p.usuario_id,'nombre',p.nombre,'biografia',p.biografia,'visible',p.visible,
 'seguidores',(select count(*) from public.social_seguimientos where seguido_id=p.usuario_id),
 'siguiendo',(select count(*) from public.social_seguimientos where seguidor_id=p.usuario_id),
 'suscripciones',(select count(*) from public.social_suscripciones where perfil_id=p.usuario_id and referencia is not null and vigente_hasta>now()),
 'donaciones',(select count(*) from public.social_donaciones where perfil_id=p.usuario_id),
 'lo_sigo',exists(select 1 from public.social_seguimientos where seguidor_id=auth.uid() and seguido_id=p.usuario_id));
end $$;
revoke all on function public.social_registrar_suscripcion(uuid,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.social_registrar_suscripcion(uuid,uuid,text,timestamptz) to authenticated;

create table public.social_notificaciones (
 id uuid primary key default gen_random_uuid(),
 usuario_id uuid not null references auth.users(id) on delete cascade,
 publicacion_id uuid not null references public.comunidad_publicaciones(id) on delete cascade,
 leida boolean not null default false,
 creado_en timestamptz not null default now(),unique(usuario_id,publicacion_id)
);
create index social_notificaciones_usuario_idx on public.social_notificaciones(usuario_id,creado_en desc,id desc);
alter table public.social_notificaciones enable row level security;
revoke all on public.social_notificaciones from public,anon,authenticated;
grant select on public.social_notificaciones to authenticated;
grant update(leida) on public.social_notificaciones to authenticated;
create policy social_avisos_leer on public.social_notificaciones for select to authenticated using(usuario_id=(select auth.uid()) and exists(select 1 from public.comunidad_publicaciones p where p.id=publicacion_id));
create policy social_avisos_marcar on public.social_notificaciones for update to authenticated using(usuario_id=(select auth.uid())) with check(usuario_id=(select auth.uid()));
create function public.social_avisar_publicacion() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not new.oculto then
  insert into public.social_notificaciones(usuario_id,publicacion_id)
  select s.seguidor_id,new.id from public.social_seguimientos s join public.social_perfiles p on p.usuario_id=s.seguido_id and p.visible where s.seguido_id=new.autor_id on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.social_avisar_publicacion() from public,anon,authenticated;
create trigger social_nueva_publicacion after insert on public.comunidad_publicaciones for each row execute function public.social_avisar_publicacion();
commit;
