begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$ begin
 if not exists(select 1 from vault.secrets where name='social_push_job_secret')
 or not exists(select 1 from vault.secrets where name='social_push_anon_jwt') then
 raise exception 'Faltan secretos push en Vault'; end if;
 if has_function_privilege('anon','public.social_reservar_push()','execute')
 or has_function_privilege('authenticated','public.social_reservar_push()','execute') then
 raise exception 'La cola permite acceso no autorizado'; end if;
end $$;
select cron.schedule('army-social-push','* * * * *', $job$
select net.http_post(
 url := 'https://buhgdsnxmmoqshvoyyth.supabase.co/functions/v1/social-push',
 headers := jsonb_build_object('Content-Type','application/json',
 'Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='social_push_anon_jwt'),
 'x-social-job-secret',(select decrypted_secret from vault.decrypted_secrets where name='social_push_job_secret')),
 body := '{}'::jsonb, timeout_milliseconds := 60000
);
$job$);
commit;
select jobname,schedule,active from cron.job where jobname='army-social-push';
