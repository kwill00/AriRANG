-- Inventario de esquema exclusivamente; no consulta filas de usuarios.
begin read only;
select 'tables' as section, jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind,'rls',c.relrowsecurity) order by c.relname) as inventory
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p','v','m')
union all
select 'functions', jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'definer',p.prosecdef,'language',l.lanname,'result',pg_get_function_result(p.oid)) order by p.proname)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
where n.nspname='public' and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
union all
select 'auth_triggers', jsonb_agg(jsonb_build_object('trigger',t.tgname,'function',p.proname,'schema',n.nspname))
from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace
where t.tgrelid='auth.users'::regclass and not t.tgisinternal;
rollback;
