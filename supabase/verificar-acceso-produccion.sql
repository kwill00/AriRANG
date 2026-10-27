-- Comprobaciones sin cuentas nuevas ni filas personales. Sin habilitar banderas.
begin;
set local lock_timeout='2s';
set local statement_timeout='15s';
select policy_version,public_ready,minors_enabled,teen_self_access_enabled,deletion_reviewed
from privacy_private.configuration;
set local role anon;
select public.privacy_registration_ready() as registro_adulto,
       public.privacy_teen_registration_ready() as registro_adolescente,
       has_schema_privilege(current_user,'privacy_private','USAGE') as acceso_esquema_privado;
do $$ begin
  if public.privacy_registration_ready() or public.privacy_teen_registration_ready()
     or has_schema_privilege(current_user,'privacy_private','USAGE') then
    raise exception 'ERROR: configuración anónima distinta del estado cerrado esperado';
  end if;
end $$;
reset role;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000099';
select public.privacy_access_mode() as modo_sin_aceptacion,
       public.privacy_access_allowed() as acceso_adulto,
       public.privacy_minor_access_allowed() as acceso_menor,
       has_schema_privilege(current_user,'privacy_private','USAGE') as acceso_esquema_privado;
-- Estas comprobaciones están diseñadas para la configuración cerrada inicial.
do $$ begin
  if public.privacy_access_mode()<>'restricted' or public.privacy_access_allowed()
     or public.privacy_minor_access_allowed()
     or has_schema_privilege(current_user,'privacy_private','USAGE') then
    raise exception 'ERROR: acceso inesperado sin aceptación';
  end if;
  begin
    perform public.privacy_accept_adult('2026-10-26.2',true,true);
    raise exception 'ERROR: se permitió una aceptación con el servicio cerrado';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.privacy_accept_teen('2026-10-26.2',true,true);
    raise exception 'ERROR: se permitió una aceptación adolescente con el servicio cerrado';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
