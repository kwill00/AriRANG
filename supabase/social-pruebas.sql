begin;
do $$ declare u record; pr uuid; begin
 for u in select id from auth.users loop
 perform set_config('request.jwt.claim.sub',u.id::text,true);
 if coalesce(public.es_admin(),false) then perform set_config('test.a',u.id::text,true); else perform set_config('test.b',u.id::text,true); end if;
 end loop;
 if nullif(current_setting('test.a',true),'') is null or nullif(current_setting('test.b',true),'') is null then raise exception 'Faltan cuentas'; end if;
 insert into public.social_perfiles(usuario_id,nombre) values(current_setting('test.a')::uuid,'Autora de prueba'),(current_setting('test.b')::uuid,'Seguidora de prueba') on conflict(usuario_id) do update set visible=true;
 insert into public.proyectos(autor_id,titulo,descripcion,tipo,estado) values(current_setting('test.a')::uuid,'Proyecto prueba social','Descripcion temporal del proyecto de prueba','propuesta','borrador') returning id into pr;
 if exists(select 1 from public.comunidad_publicaciones where proyecto_id=pr) then raise exception 'FALLO: borrador en feed'; end if;
 perform set_config('test.proyecto',pr::text,true);
 perform set_config('request.jwt.claim.sub',current_setting('test.b'),true);
end $$;
set local role authenticated;
do $$ begin
 perform public.social_interactuar(current_setting('test.a')::uuid,'seguir',true);
 perform public.social_interactuar(current_setting('test.a')::uuid,'seguir',true);
 begin perform public.social_interactuar(current_setting('test.a')::uuid,'suscribir',true); raise exception 'FALLO: suscripcion no verificada'; exception when invalid_parameter_value then null; end;
 begin perform public.social_registrar_donacion(current_setting('test.a')::uuid,'prueba-no-admin'); raise exception 'FALLO: usuario registra donacion'; exception when insufficient_privilege then null; end;
 begin perform public.social_registrar_suscripcion(auth.uid(),current_setting('test.a')::uuid,'prueba-no-admin',now()+interval '1 month'); raise exception 'FALLO: usuario registra suscripcion'; exception when insufficient_privilege then null; end;
 begin update public.social_perfiles set nombre='Suplantacion' where usuario_id=current_setting('test.a')::uuid; if found then raise exception 'FALLO: editar perfil ajeno'; end if; end;
 begin perform 1 from public.social_push_dispositivos; raise exception 'FALLO: lee claves push'; exception when insufficient_privilege then null; end;
 begin perform public.social_guardar_push('https://example.com/private',repeat('A',87),repeat('B',22)); raise exception 'FALLO: endpoint externo'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
update public.proyectos set estado='publicado' where id=current_setting('test.proyecto')::uuid;
do $$ begin
 if (select count(*) from public.comunidad_publicaciones where proyecto_id=current_setting('test.proyecto')::uuid)<>1 then raise exception 'FALLO: duplicacion proyecto'; end if;
 perform set_config('test.post',(select id::text from public.comunidad_publicaciones where proyecto_id=current_setting('test.proyecto')::uuid),true);
 perform set_config('request.jwt.claim.sub',current_setting('test.b'),true);
end $$;
set local role authenticated;
do $$ declare aviso uuid; begin
 if not exists(select 1 from public.comunidad_publicaciones where proyecto_id=current_setting('test.proyecto')::uuid) then raise exception 'FALLO: proyecto publicado invisible'; end if;
 insert into public.comunidad_comentarios(publicacion_id,autor_id,contenido) values(current_setting('test.post')::uuid,auth.uid(),'Conversacion del proyecto');
 insert into public.comunidad_hearts(publicacion_id,usuario_id) values(current_setting('test.post')::uuid,auth.uid());
 select id into aviso from public.social_notificaciones where publicacion_id=current_setting('test.post')::uuid;
 if aviso is null then raise exception 'FALLO: falta aviso seguidor'; end if;
 update public.social_notificaciones set leida=true where id=aviso;
 perform set_config('request.jwt.claim.sub',current_setting('test.a'),true);
 if exists(select 1 from public.social_notificaciones where id=aviso) then raise exception 'FALLO: aviso ajeno visible'; end if;
 perform public.social_registrar_donacion(auth.uid(),'TEST-DONACION-'||current_setting('test.post'));
 perform public.social_registrar_suscripcion(current_setting('test.b')::uuid,auth.uid(),'TEST-SUSCRIPCION-'||current_setting('test.post'),now()+interval '1 month');
 if (public.social_perfil(auth.uid())->>'donaciones')::int<1 or (public.social_perfil(auth.uid())->>'suscripciones')::int<1 then raise exception 'FALLO: contadores'; end if;
 begin perform public.social_registrar_donacion(auth.uid(),'TEST-DONACION-'||current_setting('test.post')); raise exception 'FALLO: donacion duplicada'; exception when unique_violation then null; end;
end $$;
reset role;
update public.social_perfiles set visible=false where usuario_id=current_setting('test.a')::uuid;
select set_config('request.jwt.claim.sub',current_setting('test.b'),true);
set local role authenticated;
do $$ begin
 if public.social_perfil(current_setting('test.a')::uuid) is not null then raise exception 'FALLO: perfil oculto visible'; end if;
 perform public.social_interactuar(current_setting('test.a')::uuid,'seguir',false);
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.social_perfil(current_setting('test.a')::uuid); raise exception 'FALLO: anon lee perfil'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.social_notificaciones; raise exception 'FALLO: anon lee avisos'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: borradores privados, proyecto en feed, comentarios/hearts, seguidores, avisos privados, pagos solo admin, contadores verificados, perfiles optativos y claves push privadas. ROLLBACK.' as resultado;
rollback;