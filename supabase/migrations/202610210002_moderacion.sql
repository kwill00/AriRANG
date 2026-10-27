begin;
alter table public.comunidad_publicaciones add column oculto boolean not null default false;
alter table public.comunidad_comentarios add column oculto boolean not null default false;
create table public.comunidad_reportes (
 id uuid primary key default gen_random_uuid(),
 denunciante_id uuid not null references auth.users(id) on delete cascade,
 publicacion_id uuid references public.comunidad_publicaciones(id) on delete cascade,
 comentario_id uuid references public.comunidad_comentarios(id) on delete cascade,
 motivo text not null check (char_length(btrim(motivo)) between 10 and 1000),
 estado text not null default 'pendiente' check (estado in ('pendiente','oculto','descartado','restaurado')),
 creado_en timestamptz not null default now(),
 revisor_id uuid references auth.users(id) on delete set null,
 revisado_en timestamptz,
 nota_revision text,
 check (num_nonnulls(publicacion_id, comentario_id) = 1)
);
create unique index comunidad_reportes_post_unico on public.comunidad_reportes(denunciante_id,publicacion_id) where publicacion_id is not null;
create unique index comunidad_reportes_comentario_unico on public.comunidad_reportes(denunciante_id,comentario_id) where comentario_id is not null;
create index comunidad_reportes_pendientes on public.comunidad_reportes(estado,creado_en,id);
create index comunidad_reportes_publicacion on public.comunidad_reportes(publicacion_id);
create index comunidad_reportes_comentario on public.comunidad_reportes(comentario_id);
create table public.comunidad_moderacion_historial (
 id uuid primary key default gen_random_uuid(),
 reporte_id uuid not null references public.comunidad_reportes(id) on delete cascade,
 revisor_id uuid references auth.users(id) on delete set null,
 accion text not null check (accion in ('ocultar','restaurar','descartar')),
 nota text not null check (char_length(btrim(nota)) between 5 and 1000),
 creado_en timestamptz not null default now()
);
alter table public.comunidad_reportes enable row level security;
alter table public.comunidad_moderacion_historial enable row level security;
revoke all on public.comunidad_reportes,public.comunidad_moderacion_historial from public,anon,authenticated;
grant select on public.comunidad_reportes,public.comunidad_moderacion_historial to authenticated;
create policy comunidad_reportes_admin on public.comunidad_reportes for select to authenticated using ((select public.es_admin()));
create policy comunidad_historial_admin on public.comunidad_moderacion_historial for select to authenticated using ((select public.es_admin()));

-- Ocultamiento real: las políticas de lectura se aplican también a llamadas REST.
drop policy comunidad_publicaciones_leer on public.comunidad_publicaciones;
create policy comunidad_publicaciones_leer on public.comunidad_publicaciones for select to authenticated using (not oculto);
drop policy comunidad_comentarios_leer on public.comunidad_comentarios;
create policy comunidad_comentarios_leer on public.comunidad_comentarios for select to authenticated using (not oculto and exists(select 1 from public.comunidad_publicaciones p where p.id=publicacion_id));
drop policy comunidad_hearts_leer on public.comunidad_hearts;
create policy comunidad_hearts_leer on public.comunidad_hearts for select to authenticated using (exists(select 1 from public.comunidad_publicaciones p where p.id=publicacion_id));

create function public.comunidad_reportar(p_publicacion_id uuid, p_comentario_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Iniciá sesión' using errcode='42501'; end if;
 if num_nonnulls(p_publicacion_id,p_comentario_id) <> 1 then raise exception 'Destino inválido' using errcode='22023'; end if;
 if p_motivo is null or char_length(btrim(p_motivo)) not between 10 and 1000 then raise exception 'Motivo inválido' using errcode='22023'; end if;
 if p_publicacion_id is not null then
  perform 1 from public.comunidad_publicaciones where id=p_publicacion_id and not oculto for share;
 else
  perform 1 from public.comunidad_comentarios c join public.comunidad_publicaciones p on p.id=c.publicacion_id where c.id=p_comentario_id and not c.oculto and not p.oculto for share of c,p;
 end if;
 if not found then raise exception 'Contenido no disponible' using errcode='42501'; end if;
 insert into public.comunidad_reportes(denunciante_id,publicacion_id,comentario_id,motivo) values(auth.uid(),p_publicacion_id,p_comentario_id,btrim(p_motivo));
end $$;

create function public.comunidad_listar_reportes(p_estado text default 'pendiente',p_pagina integer default 0)
returns table(id uuid,motivo text,estado text,creado_en timestamptz,titulo text,contenido text,oculto boolean,comentario boolean,nota_revision text)
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'Solo administración' using errcode='42501'; end if;
 if p_estado is null or p_estado not in ('pendiente','oculto','descartado','restaurado') or p_pagina is null or p_pagina not between 0 and 10000 then raise exception 'Filtro inválido' using errcode='22023'; end if;
 return query select r.id,r.motivo,r.estado,r.creado_en,coalesce(p.titulo,pc.titulo),coalesce(c.contenido,p.contenido),coalesce(c.oculto,p.oculto),r.comentario_id is not null,r.nota_revision
 from public.comunidad_reportes r left join public.comunidad_publicaciones p on p.id=r.publicacion_id left join public.comunidad_comentarios c on c.id=r.comentario_id left join public.comunidad_publicaciones pc on pc.id=c.publicacion_id
 where r.estado=p_estado order by r.creado_en,r.id limit 21 offset p_pagina*20;
end $$;

create function public.comunidad_revisar_reporte(p_reporte_id uuid,p_accion text,p_nota text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.comunidad_reportes; v_oculto boolean;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'Solo administración' using errcode='42501'; end if;
 if p_accion is null or p_accion not in ('ocultar','restaurar','descartar') or p_nota is null or char_length(btrim(p_nota)) not between 5 and 1000 then raise exception 'Revisión inválida' using errcode='22023'; end if;
 select * into r from public.comunidad_reportes where id=p_reporte_id for update;
 if not found then raise exception 'Reporte inexistente' using errcode='22023'; end if;
 if p_accion='descartar' and r.estado <> 'pendiente' then raise exception 'El reporte ya fue revisado' using errcode='22023'; end if;
 if p_accion <> 'descartar' then
  if r.publicacion_id is not null then
   select oculto into v_oculto from public.comunidad_publicaciones where id=r.publicacion_id for update;
   if v_oculto = (p_accion='ocultar') then raise exception 'El contenido ya está en ese estado' using errcode='22023'; end if;
   update public.comunidad_publicaciones set oculto=(p_accion='ocultar') where id=r.publicacion_id;
  else
   select oculto into v_oculto from public.comunidad_comentarios where id=r.comentario_id for update;
   if v_oculto = (p_accion='ocultar') then raise exception 'El contenido ya está en ese estado' using errcode='22023'; end if;
   update public.comunidad_comentarios set oculto=(p_accion='ocultar') where id=r.comentario_id;
  end if;
 end if;
 update public.comunidad_reportes set estado=case p_accion when 'ocultar' then 'oculto' when 'restaurar' then 'restaurado' else 'descartado' end,revisor_id=auth.uid(),revisado_en=now(),nota_revision=btrim(p_nota) where id=r.id;
 insert into public.comunidad_moderacion_historial(reporte_id,revisor_id,accion,nota) values(r.id,auth.uid(),p_accion,btrim(p_nota));
end $$;
revoke all on function public.comunidad_reportar(uuid,uuid,text),public.comunidad_listar_reportes(text,integer),public.comunidad_revisar_reporte(uuid,text,text) from public,anon,authenticated;
grant execute on function public.comunidad_reportar(uuid,uuid,text),public.comunidad_listar_reportes(text,integer),public.comunidad_revisar_reporte(uuid,text,text) to authenticated;
commit;
