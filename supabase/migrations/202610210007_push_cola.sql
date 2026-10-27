begin;
alter table public.social_notificaciones add column if not exists push_reservada_hasta timestamptz;
create or replace function public.social_reservar_push()
returns setof public.social_notificaciones
language sql security definer set search_path='' as $$
  with pendientes as (
    select id from public.social_notificaciones
    where not push_enviada and push_intentos < 5
      and creado_en >= now() - interval '1 day'
      and (push_reservada_hasta is null or push_reservada_hasta < now())
    order by creado_en,id limit 5 for update skip locked
  )
  update public.social_notificaciones n
  set push_reservada_hasta=now()+interval '5 minutes',push_intentos=n.push_intentos+1
  from pendientes p where n.id=p.id returning n.*;
$$;
revoke all on function public.social_reservar_push() from public,anon,authenticated;
grant execute on function public.social_reservar_push() to service_role;
commit;
