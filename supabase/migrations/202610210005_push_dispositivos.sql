begin;
create table public.social_push_dispositivos (
 endpoint text primary key,
 usuario_id uuid not null references auth.users(id) on delete cascade,
 p256dh text not null,
 auth text not null,
 actualizado_en timestamptz not null default now()
);
create index social_push_usuario_idx on public.social_push_dispositivos(usuario_id);
alter table public.social_push_dispositivos enable row level security;
revoke all on public.social_push_dispositivos from public,anon,authenticated;
grant all on public.social_push_dispositivos to service_role;
alter table public.social_notificaciones add column push_enviada boolean not null default false;
alter table public.social_notificaciones add column push_intentos integer not null default 0;
grant select,update on public.social_notificaciones to service_role;
create function public.social_guardar_push(p_endpoint text,p_p256dh text,p_auth text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Iniciá sesión' using errcode='42501'; end if;
 if p_endpoint is null or length(p_endpoint)>2048 or p_endpoint !~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com|[a-z0-9-]+[.]notify[.]windows[.]com)/' or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{80,120}$' or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{20,30}$' then raise exception 'Dispositivo inválido' using errcode='22023'; end if;
 if exists(select 1 from public.social_push_dispositivos where endpoint=p_endpoint and usuario_id<>auth.uid()) then raise exception 'Desactivá las notificaciones de la cuenta anterior en este dispositivo' using errcode='42501'; end if;
 if not exists(select 1 from public.social_push_dispositivos where endpoint=p_endpoint) and (select count(*) from public.social_push_dispositivos where usuario_id=auth.uid())>=10 then raise exception 'Límite de dispositivos' using errcode='22023'; end if;
 insert into public.social_push_dispositivos values(p_endpoint,auth.uid(),p_p256dh,p_auth,now()) on conflict(endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth,actualizado_en=now();
end $$;
create function public.social_eliminar_push(p_endpoint text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Iniciá sesión' using errcode='42501'; end if;
 delete from public.social_push_dispositivos where endpoint=p_endpoint and usuario_id=auth.uid();
end $$;
revoke all on function public.social_guardar_push(text,text,text),public.social_eliminar_push(text) from public,anon,authenticated;
grant execute on function public.social_guardar_push(text,text,text),public.social_eliminar_push(text) to authenticated;
commit;
