begin;
alter table public.comunidad_publicaciones add column proyecto_id uuid unique references public.proyectos(id) on delete cascade;

create function public.comunidad_sincronizar_proyecto() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.estado='publicado' then
  insert into public.comunidad_publicaciones(autor_id,titulo,contenido,tipo,proyecto_id)
  values(new.autor_id,new.titulo,new.descripcion,'publicacion',new.id)
  on conflict(proyecto_id) do update set titulo=excluded.titulo,contenido=excluded.contenido;
 end if;
 return new;
end $$;
revoke all on function public.comunidad_sincronizar_proyecto() from public,anon,authenticated;
create trigger comunidad_proyecto_publicado after insert or update of estado,titulo,descripcion on public.proyectos for each row execute function public.comunidad_sincronizar_proyecto();
insert into public.comunidad_publicaciones(autor_id,titulo,contenido,tipo,proyecto_id)
select autor_id,titulo,descripcion,'publicacion',id from public.proyectos where estado='publicado';
drop policy comunidad_publicaciones_leer on public.comunidad_publicaciones;
create policy comunidad_publicaciones_leer on public.comunidad_publicaciones for select to authenticated using(not oculto and (proyecto_id is null or exists(select 1 from public.proyectos p where p.id=proyecto_id and p.estado='publicado')));

create table public.social_perfiles (
 usuario_id uuid primary key references auth.users(id) on delete cascade,
 nombre text not null check(char_length(btrim(nombre)) between 2 and 80),
 biografia text not null default '' check(char_length(biografia)<=500),
 visible boolean not null default true
);
create table public.social_seguimientos (
 seguidor_id uuid not null references auth.users(id) on delete cascade,
 seguido_id uuid not null references public.social_perfiles(usuario_id) on delete cascade,
 primary key(seguidor_id,seguido_id),check(seguidor_id<>seguido_id)
);
create index social_seguidos_idx on public.social_seguimientos(seguido_id);
create table public.social_suscripciones (
 usuario_id uuid not null references auth.users(id) on delete cascade,
 perfil_id uuid not null references public.social_perfiles(usuario_id) on delete cascade,
 primary key(usuario_id,perfil_id),check(usuario_id<>perfil_id)
);
create index social_suscripciones_perfil_idx on public.social_suscripciones(perfil_id);
create table public.social_donaciones (
 id uuid primary key default gen_random_uuid(),
 perfil_id uuid not null references public.social_perfiles(usuario_id) on delete cascade,
 referencia text not null unique check(char_length(btrim(referencia)) between 5 and 150),
 verificador_id uuid references auth.users(id) on delete set null,
 creado_en timestamptz not null default now()
);
create index social_donaciones_perfil_idx on public.social_donaciones(perfil_id);
alter table public.social_perfiles enable row level security;
alter table public.social_seguimientos enable row level security;
alter table public.social_suscripciones enable row level security;
alter table public.social_donaciones enable row level security;
revoke all on public.social_perfiles,public.social_seguimientos,public.social_suscripciones,public.social_donaciones from public,anon,authenticated;
grant select on public.social_perfiles to authenticated;
grant insert(usuario_id,nombre,biografia,visible),update(nombre,biografia,visible) on public.social_perfiles to authenticated;
create policy social_perfiles_leer on public.social_perfiles for select to authenticated using(visible or usuario_id=(select auth.uid()));
create policy social_perfiles_crear on public.social_perfiles for insert to authenticated with check(usuario_id=(select auth.uid()));
create policy social_perfiles_editar on public.social_perfiles for update to authenticated using(usuario_id=(select auth.uid())) with check(usuario_id=(select auth.uid()));

create function public.social_perfil(p_usuario_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.social_perfiles;
begin
 if auth.uid() is null then raise exception 'Iniciá sesión' using errcode='42501'; end if;
 select * into p from public.social_perfiles where usuario_id=p_usuario_id and (visible or usuario_id=auth.uid());
 if not found then return null; end if;
 return jsonb_build_object('usuario_id',p.usuario_id,'nombre',p.nombre,'biografia',p.biografia,'visible',p.visible,
 'seguidores',(select count(*) from public.social_seguimientos where seguido_id=p.usuario_id),
 'siguiendo',(select count(*) from public.social_seguimientos where seguidor_id=p.usuario_id),
 'suscripciones',(select count(*) from public.social_suscripciones where perfil_id=p.usuario_id),
 'donaciones',(select count(*) from public.social_donaciones where perfil_id=p.usuario_id),
 'lo_sigo',exists(select 1 from public.social_seguimientos where seguidor_id=auth.uid() and seguido_id=p.usuario_id),
 'suscrito',exists(select 1 from public.social_suscripciones where usuario_id=auth.uid() and perfil_id=p.usuario_id));
end $$;
create function public.social_interactuar(p_perfil_id uuid,p_tipo text,p_activo boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid()=p_perfil_id then raise exception 'Interacción inválida' using errcode='42501'; end if;
 if p_tipo is null or p_tipo not in ('seguir','suscribir') or p_activo is null then raise exception 'Acción inválida' using errcode='22023'; end if;
 -- Siempre permitir cancelar una interacción aunque el perfil deje de ser visible.
 if p_activo then
  perform 1 from public.social_perfiles where usuario_id=p_perfil_id and visible for share;
  if not found then raise exception 'Perfil no disponible' using errcode='42501'; end if;
 end if;
 if p_tipo='seguir' then
  if p_activo then insert into public.social_seguimientos values(auth.uid(),p_perfil_id) on conflict do nothing;
  else delete from public.social_seguimientos where seguidor_id=auth.uid() and seguido_id=p_perfil_id; end if;
 else
  if p_activo then insert into public.social_suscripciones values(auth.uid(),p_perfil_id) on conflict do nothing;
  else delete from public.social_suscripciones where usuario_id=auth.uid() and perfil_id=p_perfil_id; end if;
 end if;
end $$;
create function public.social_registrar_donacion(p_perfil_id uuid,p_referencia text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'Solo administración' using errcode='42501'; end if;
 insert into public.social_donaciones(perfil_id,referencia,verificador_id) values(p_perfil_id,btrim(p_referencia),auth.uid());
end $$;
revoke all on function public.social_perfil(uuid),public.social_interactuar(uuid,text,boolean),public.social_registrar_donacion(uuid,text) from public,anon,authenticated;
grant execute on function public.social_perfil(uuid),public.social_interactuar(uuid,text,boolean),public.social_registrar_donacion(uuid,text) to authenticated;
commit;
