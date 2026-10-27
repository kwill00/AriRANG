-- Solo lectura. Ejecutar en SQL Editor del proyecto correcto de Supabase.
-- No devuelve correos, identificadores, consentimientos individuales ni secretos.
select
  to_regprocedure('public.privacy_access_mode()') is not null as modo_instalado,
  to_regprocedure('public.privacy_accept_adult(text,boolean,boolean)') is not null as aceptacion_adulta_instalada,
  to_regprocedure('public.privacy_accept_teen(text,boolean,boolean)') is not null as aceptacion_adolescente_instalada,
  to_regprocedure('public.privacy_teen_registration_ready()') is not null as registro_adolescente_instalado,
  to_regclass('privacy_private.configuration') is not null as configuracion_instalada;

-- Si configuracion_instalada=true y se aplicaron todas las migraciones, ejecutar:
-- select policy_version, public_ready, minors_enabled, teen_self_access_enabled,
--        deletion_reviewed from privacy_private.configuration;
-- La versión esperada es 2026-10-26.2. No cambiar consentimientos individuales.
