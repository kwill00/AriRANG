-- Plantilla pendiente de activación. Ejecutar solo después de desplegar el emisor
-- y crear los secretos social_push_job_secret y social_push_project_url en Vault.
-- No incluir sus valores en este archivo ni en el frontend.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='social_push_job_secret')
 or not exists(select 1 from vault.decrypted_secrets where name='social_push_project_url') then
  raise exception 'Faltan los secretos de configuración push en Vault';
 end if;
 if exists(select 1 from cron.job where jobname='army-social-push') then
  raise exception 'El trabajo ya existe. Revisar antes de crear otro';
 end if;
 perform cron.schedule('army-social-push','* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='social_push_project_url') || '/functions/v1/social-push',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='social_push_job_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
 $job$);
end $$;
