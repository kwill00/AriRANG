begin;
do $$ begin
 if (select count(*) from auth.users)<2 then raise exception 'Faltan dos cuentas'; end if;
 perform set_config('test.a',(select id::text from auth.users order by id limit 1),true);
 perform set_config('test.b',(select id::text from auth.users order by id limit 1 offset 1),true);
 insert into public.social_perfiles(usuario_id,nombre,visible) values(current_setting('test.a')::uuid,'Nombre social A',true),(current_setting('test.b')::uuid,'Nombre social B',true) on conflict(usuario_id) do update set nombre=excluded.nombre,visible=true;
 insert into public.social_seguimientos(seguidor_id,seguido_id) values(current_setting('test.a')::uuid,current_setting('test.b')::uuid),(current_setting('test.b')::uuid,current_setting('test.a')::uuid) on conflict do nothing;
 perform set_config('request.jwt.claim.sub',current_setting('test.a'),true);
end $$;
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.social_listar_conexiones(current_setting('test.a')::uuid,'seguidores',0) where usuario_id=current_setting('test.b')::uuid and nombre='Nombre social B' and puede_abrir and lo_sigo) then raise exception 'FALLO: seguidores'; end if;
 if not exists(select 1 from public.social_listar_conexiones(current_setting('test.a')::uuid,'siguiendo',0) where usuario_id=current_setting('test.b')::uuid and nombre='Nombre social B') then raise exception 'FALLO: siguiendo'; end if;
 if exists(select 1 from public.social_listar_conexiones(current_setting('test.a')::uuid,'siguiendo',10000)) then raise exception 'FALLO: paginacion'; end if;
 begin perform public.social_listar_conexiones(current_setting('test.a')::uuid,'privado',0); raise exception 'FALLO: tipo'; exception when invalid_parameter_value then null; end;
 begin perform public.social_listar_conexiones(current_setting('test.a')::uuid,'siguiendo',-1); raise exception 'FALLO: pagina'; exception when invalid_parameter_value then null; end;
 begin perform 1 from public.social_seguimientos; raise exception 'FALLO: acceso a relaciones sin filtro'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.social_perfiles set visible=false where usuario_id=current_setting('test.b')::uuid;
set local role authenticated;
do $$ begin
 if exists(select 1 from public.social_perfiles where usuario_id=current_setting('test.b')::uuid) then raise exception 'FALLO: nombre oculto'; end if;
 if exists(select 1 from public.social_listar_conexiones(current_setting('test.a')::uuid,'seguidores',0) where usuario_id=current_setting('test.b')::uuid) then raise exception 'FALLO: seguidor oculto expuesto'; end if;
 if exists(select 1 from public.social_listar_conexiones(current_setting('test.b')::uuid,'siguiendo',0)) then raise exception 'FALLO: relaciones de perfil oculto expuestas'; end if;
 if not exists(select 1 from public.social_listar_conexiones(current_setting('test.a')::uuid,'siguiendo',0) where usuario_id=current_setting('test.b')::uuid and nombre='Perfil no visible' and not puede_abrir and lo_sigo) then raise exception 'FALLO: gestionar seguimiento oculto'; end if;
 perform public.social_interactuar(current_setting('test.b')::uuid,'seguir',false);
 if exists(select 1 from public.social_listar_conexiones(current_setting('test.a')::uuid,'siguiendo',0) where usuario_id=current_setting('test.b')::uuid) then raise exception 'FALLO: dejar de seguir'; end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.b'),true);
 if not exists(select 1 from public.social_listar_conexiones(current_setting('test.b')::uuid,'siguiendo',0) where usuario_id=current_setting('test.a')::uuid) then raise exception 'FALLO: gestion de perfil propio oculto'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.social_listar_conexiones(current_setting('test.a')::uuid,'seguidores',0); raise exception 'FALLO: anon'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: nombres sociales, seguidores y seguidos, privacidad de perfiles ocultos, cancelacion, paginacion, validacion y bloqueo anonimo. ROLLBACK sin cambios de prueba persistentes.' as resultado;
rollback;