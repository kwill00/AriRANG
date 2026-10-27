-- Disposable local fixture, NOT a reconstruction of the connected Supabase schema.
-- Auth, Storage and the four legacy tables are minimal substitutes for SQL tests.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
grant usage on schema auth,storage,public to anon,authenticated,service_role;
create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create table storage.objects(id uuid primary key default gen_random_uuid(),owner_id text);
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated,service_role;
create policy fixture_storage_owner on storage.objects to authenticated using(owner_id=auth.uid()::text) with check(owner_id=auth.uid()::text);
create table public.perfiles(id uuid primary key references auth.users(id) on delete cascade,nombre text,rol text default 'army');
create table public.viajes(id uuid primary key default gen_random_uuid(),usuario_id uuid references auth.users(id) on delete cascade,destino text);
create table public.proyectos(id uuid primary key default gen_random_uuid(),autor_id uuid not null references auth.users(id) on delete cascade,titulo text not null,descripcion text not null,estado text not null default 'borrador',tipo text default 'propuesta',pais text,ciudad text,concierto text);
create table public.solicitudes_organizadora(id uuid primary key default gen_random_uuid(),usuario_id uuid references auth.users(id) on delete cascade,estado text default 'pendiente');
grant all on public.perfiles,public.viajes,public.proyectos,public.solicitudes_organizadora to authenticated,service_role;
create function public.es_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.perfiles where id=auth.uid() and rol='admin')
$$;
alter table public.perfiles enable row level security;
create policy fixture_profiles on public.perfiles to authenticated using(id=auth.uid() or public.es_admin());
alter table public.viajes enable row level security;
create policy fixture_trips on public.viajes to authenticated using(usuario_id=auth.uid()) with check(usuario_id=auth.uid());
alter table public.proyectos enable row level security;
create policy fixture_projects on public.proyectos to authenticated using(autor_id=auth.uid() or estado='publicado') with check(autor_id=auth.uid());
alter table public.solicitudes_organizadora enable row level security;
create policy fixture_requests on public.solicitudes_organizadora to authenticated using(usuario_id=auth.uid() or public.es_admin()) with check(usuario_id=auth.uid());
-- Deliberately inherited PUBLIC grant to test that anonymous access stays denied.
grant select on public.proyectos to public;
create policy fixture_public_projects on public.proyectos for select to anon using(true);
create view public.fixture_project_view as select * from public.proyectos;
grant select on public.fixture_project_view to authenticated;
create function public.fixture_privileged_probe() returns text language plpgsql security definer set search_path='' as $$
begin return 'sensitive-fixture-value'; end $$;
grant execute on function public.fixture_privileged_probe() to authenticated;
