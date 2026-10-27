begin;
do $$ declare u record; begin
 for u in select id from auth.users loop
  perform set_config('request.jwt.claim.sub',u.id::text,true);
  if coalesce(public.es_admin(),false) then perform set_config('test.admin',u.id::text,true); else perform set_config('test.user',u.id::text,true); end if;
 end loop;
 if nullif(current_setting('test.admin',true),'') is null or nullif(current_setting('test.user',true),'') is null then raise exception 'Se necesita admin y usuario común'; end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.user'),true);
end $$;
set local role authenticated;
do $$ declare p uuid; c uuid; begin
 insert into public.comunidad_publicaciones(autor_id,titulo,contenido,tipo) values(auth.uid(),'Prueba moderacion','Contenido temporal de moderacion','debate') returning id into p;
 insert into public.comunidad_comentarios(publicacion_id,autor_id,contenido) values(p,auth.uid(),'Comentario temporal') returning id into c;
 insert into public.comunidad_hearts(publicacion_id,usuario_id) values(p,auth.uid());
 perform set_config('test.post',p::text,true); perform set_config('test.comment',c::text,true);
 perform public.comunidad_reportar(p,null,'Reporte temporal de publicacion');
 perform public.comunidad_reportar(null,c,'Reporte temporal de comentario');
 begin perform public.comunidad_reportar(p,null,'Reporte duplicado de prueba'); raise exception 'FALLO: duplicado'; exception when unique_violation then null; end;
 begin perform public.comunidad_listar_reportes(); raise exception 'FALLO: usuario lista reportes'; exception when insufficient_privilege then null; end;
 begin perform public.comunidad_revisar_reporte(gen_random_uuid(),'ocultar','Ocultamiento indebido'); raise exception 'FALLO: usuario modera'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.comunidad_reportes) then raise exception 'FALLO: usuario lee reportes'; end if;
 begin update public.comunidad_publicaciones set oculto=true where id=p; raise exception 'FALLO: update directo'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 perform set_config('test.report',(select id::text from public.comunidad_reportes where publicacion_id=current_setting('test.post')::uuid),true);
 perform set_config('test.commentreport',(select id::text from public.comunidad_reportes where comentario_id=current_setting('test.comment')::uuid),true);
 perform set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
end $$;
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.comunidad_listar_reportes('pendiente',0) where id=current_setting('test.report')::uuid) then raise exception 'FALLO: admin no lista'; end if;
 perform public.comunidad_revisar_reporte(current_setting('test.report')::uuid,'ocultar','Ocultar para prueba');
 perform set_config('request.jwt.claim.sub',current_setting('test.user'),true);
 if exists(select 1 from public.comunidad_publicaciones where id=current_setting('test.post')::uuid) then raise exception 'FALLO: post oculto visible'; end if;
 if exists(select 1 from public.comunidad_comentarios where id=current_setting('test.comment')::uuid) then raise exception 'FALLO: comentario de post oculto visible'; end if;
 if exists(select 1 from public.comunidad_hearts where publicacion_id=current_setting('test.post')::uuid) then raise exception 'FALLO: hearts de post oculto visibles'; end if;
 begin perform public.comunidad_reportar(current_setting('test.post')::uuid,null,'Reporte de oculto'); raise exception 'FALLO: reportar oculto'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
 perform public.comunidad_revisar_reporte(current_setting('test.report')::uuid,'restaurar','Restaurar para prueba');
 perform public.comunidad_revisar_reporte(current_setting('test.commentreport')::uuid,'ocultar','Ocultar comentario de prueba');
 perform set_config('request.jwt.claim.sub',current_setting('test.user'),true);
 if not exists(select 1 from public.comunidad_publicaciones where id=current_setting('test.post')::uuid) then raise exception 'FALLO: restauracion'; end if;
 if exists(select 1 from public.comunidad_comentarios where id=current_setting('test.comment')::uuid) then raise exception 'FALLO: comentario oculto visible'; end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
 perform public.comunidad_revisar_reporte(current_setting('test.commentreport')::uuid,'restaurar','Restaurar comentario de prueba');
 if (select count(*) from public.comunidad_moderacion_historial where reporte_id in (current_setting('test.report')::uuid,current_setting('test.commentreport')::uuid)) <> 4 then raise exception 'FALLO: historial'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.comunidad_listar_reportes(); raise exception 'FALLO: anon lista'; exception when insufficient_privilege then null; end;
 begin perform public.comunidad_reportar(current_setting('test.post')::uuid,null,'Reporte anonimo'); raise exception 'FALLO: anon reporta'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: reportes, duplicados, permisos admin, ocultamiento de posts/comentarios/hearts, restauracion e historial. ROLLBACK de pruebas.' as resultado;
rollback;