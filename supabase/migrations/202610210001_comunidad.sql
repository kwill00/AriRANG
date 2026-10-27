-- Pendiente de revisión y ejecución autorizada. No modifica tablas existentes.
begin;
create table public.comunidad_publicaciones (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 3 and 120),
  contenido text not null check (char_length(btrim(contenido)) between 10 and 5000),
  tipo text not null check (tipo in ('publicacion', 'debate')),
  creado_en timestamptz not null default now()
);
create table public.comunidad_comentarios (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.comunidad_publicaciones(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete cascade,
  contenido text not null check (char_length(btrim(contenido)) between 1 and 2000),
  creado_en timestamptz not null default now()
);
create table public.comunidad_hearts (
  publicacion_id uuid not null references public.comunidad_publicaciones(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  primary key (publicacion_id, usuario_id)
);
create index comunidad_feed_idx on public.comunidad_publicaciones(creado_en desc, id desc);
create index comunidad_comentarios_post_idx on public.comunidad_comentarios(publicacion_id, creado_en, id);
create index comunidad_publicaciones_autor_idx on public.comunidad_publicaciones(autor_id);
create index comunidad_comentarios_autor_idx on public.comunidad_comentarios(autor_id);
create index comunidad_hearts_usuario_idx on public.comunidad_hearts(usuario_id);

alter table public.comunidad_publicaciones enable row level security;
alter table public.comunidad_comentarios enable row level security;
alter table public.comunidad_hearts enable row level security;

revoke all on public.comunidad_publicaciones, public.comunidad_comentarios, public.comunidad_hearts from anon, authenticated;
grant select on public.comunidad_publicaciones, public.comunidad_comentarios, public.comunidad_hearts to authenticated;
grant insert (autor_id, titulo, contenido, tipo) on public.comunidad_publicaciones to authenticated;
grant insert (publicacion_id, autor_id, contenido) on public.comunidad_comentarios to authenticated;
grant insert (publicacion_id, usuario_id) on public.comunidad_hearts to authenticated;
grant delete on public.comunidad_comentarios, public.comunidad_hearts to authenticated;

create policy comunidad_publicaciones_leer on public.comunidad_publicaciones for select to authenticated using (true);
create policy comunidad_publicaciones_crear on public.comunidad_publicaciones for insert to authenticated with check (autor_id = (select auth.uid()));
create policy comunidad_comentarios_leer on public.comunidad_comentarios for select to authenticated using (true);
create policy comunidad_comentarios_crear on public.comunidad_comentarios for insert to authenticated with check (autor_id = (select auth.uid()) and exists (select 1 from public.comunidad_publicaciones p where p.id = publicacion_id));
create policy comunidad_comentarios_borrar on public.comunidad_comentarios for delete to authenticated using (autor_id = (select auth.uid()));
create policy comunidad_hearts_leer on public.comunidad_hearts for select to authenticated using (true);
create policy comunidad_hearts_crear on public.comunidad_hearts for insert to authenticated with check (usuario_id = (select auth.uid()) and exists (select 1 from public.comunidad_publicaciones p where p.id = publicacion_id));
create policy comunidad_hearts_borrar on public.comunidad_hearts for delete to authenticated using (usuario_id = (select auth.uid()));
commit;
