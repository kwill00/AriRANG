-- Minimal EMPTY app schema for a NEW disposable Supabase test project only.
-- Not a production clone. Managed Auth and Storage already exist in Supabase.
begin;
do $$ begin
 if to_regclass('public.perfiles') is not null or to_regclass('public.viajes') is not null
 or to_regclass('public.proyectos') is not null or to_regclass('privacy_private.configuration') is not null then
   raise exception 'Refusing bootstrap: this is not an empty test project';
 end if;
end $$;
create table public.perfiles (
 id uuid primary key references auth.users(id) on delete cascade,
 nombre text not null default 'Cuenta de prueba',avatar_url text,biografia text not null default '',pais text,
 rol text not null default 'army' check(rol in ('army','organizadora','admin')),verificada boolean not null default false,
 creado_en timestamptz not null default now()
);
create table public.viajes (
 id uuid primary key default gen_random_uuid(),usuario_id uuid not null references auth.users(id) on delete cascade,
 origen text,destino text,fecha_salida date,fecha_concierto date,fecha_regreso date,
 entrada numeric(12,2) not null default 0,transporte numeric(12,2) not null default 0,hotel numeric(12,2) not null default 0,
 ahorrado numeric(12,2) not null default 0,creado_en timestamptz not null default now()
);
create table public.proyectos (
 id uuid primary key default gen_random_uuid(),autor_id uuid not null references auth.users(id) on delete cascade,
 titulo text not null,descripcion text not null,tipo text not null default 'propuesta',estado text not null default 'borrador',
 pais text,ciudad text,concierto text,fecha_concierto date,fecha_ejecucion timestamptz,instrucciones text,imagen_url text,
 creado_en timestamptz not null default now()
);
create table public.solicitudes_organizadora (
 id uuid primary key default gen_random_uuid(),usuario_id uuid not null references auth.users(id) on delete cascade,
 nombre_organizacion text,pais text,descripcion text,redes_sociales text,estado text not null default 'pendiente',creado_en timestamptz not null default now()
);
create function public.es_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.perfiles where id=auth.uid() and rol='admin')
$$;
revoke all on function public.es_admin() from public,anon;
grant execute on function public.es_admin() to authenticated,service_role;
alter table public.perfiles enable row level security;
alter table public.viajes enable row level security;
alter table public.proyectos enable row level security;
alter table public.solicitudes_organizadora enable row level security;
revoke all on public.perfiles,public.viajes,public.proyectos,public.solicitudes_organizadora from public,anon,authenticated;
grant select on public.perfiles to authenticated;
grant update(nombre,avatar_url,biografia,pais) on public.perfiles to authenticated;
grant select,insert,update,delete on public.viajes,public.proyectos,public.solicitudes_organizadora to authenticated;
create policy sandbox_profile_read on public.perfiles for select to authenticated using(id=auth.uid() or public.es_admin());
create policy sandbox_profile_update on public.perfiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy sandbox_trip_owner on public.viajes to authenticated using(usuario_id=auth.uid()) with check(usuario_id=auth.uid());
create policy sandbox_project_owner on public.proyectos to authenticated using(autor_id=auth.uid()) with check(autor_id=auth.uid());
create policy sandbox_request_owner on public.solicitudes_organizadora to authenticated using(usuario_id=auth.uid() or public.es_admin()) with check(usuario_id=auth.uid());
create function public.sandbox_create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.perfiles(id) values(new.id); return new; end $$;
revoke all on function public.sandbox_create_profile() from public,anon,authenticated;
create trigger sandbox_profile_created after insert on auth.users for each row execute function public.sandbox_create_profile();
commit;
