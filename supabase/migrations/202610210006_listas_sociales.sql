begin;
-- Solo nombres sociales optativos. No se amplían permisos sobre perfiles privados.
create function public.social_listar_conexiones(p_usuario_id uuid,p_tipo text,p_pagina integer default 0)
returns table(usuario_id uuid,nombre text,puede_abrir boolean,lo_sigo boolean)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Iniciá sesión' using errcode='42501'; end if;
 if p_usuario_id is null or p_tipo is null or p_tipo not in ('seguidores','siguiendo') or p_pagina is null or p_pagina not between 0 and 10000 then raise exception 'Filtro inválido' using errcode='22023'; end if;
 if not exists(select 1 from public.social_perfiles p where p.usuario_id=p_usuario_id and (p.visible or p.usuario_id=auth.uid())) then return; end if;
 return query
 select q.persona,
 case when coalesce(p.visible,false) or q.persona=auth.uid() then coalesce(p.nombre,'Mi perfil') else 'Perfil no visible' end,
 coalesce(p.visible,false) or (q.persona=auth.uid() and p.usuario_id is not null),
 exists(select 1 from public.social_seguimientos m where m.seguidor_id=auth.uid() and m.seguido_id=q.persona)
 from (
  select case when p_tipo='seguidores' then s.seguidor_id else s.seguido_id end as persona
  from public.social_seguimientos s
  where (p_tipo='seguidores' and s.seguido_id=p_usuario_id) or (p_tipo='siguiendo' and s.seguidor_id=p_usuario_id)
 ) q left join public.social_perfiles p on p.usuario_id=q.persona
 where p.visible or q.persona=auth.uid() or (p_tipo='siguiendo' and p_usuario_id=auth.uid())
 order by case when coalesce(p.visible,false) or q.persona=auth.uid() then lower(p.nombre) else 'perfil no visible' end,q.persona
 limit 21 offset p_pagina*20;
end $$;
revoke all on function public.social_listar_conexiones(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.social_listar_conexiones(uuid,text,integer) to authenticated;
commit;
