-- Sandbox ledger only. No live payments, public policies or production flags.
begin;
create schema if not exists payment_test_private;
revoke all on schema payment_test_private from public,anon,authenticated;
create table payment_test_private.orders (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 seller_id text not null,
 request_key uuid not null,
 amount_cents integer not null default 10000 check(amount_cents=10000),
 currency text not null default 'ARS' check(currency='ARS'),
 preference_id text, checkout_url text,
 payment_id text unique,
 state text not null default 'creating' check(state in ('creating','pending','in_process','approved','rejected','cancelled','partially_refunded','refunded','charged_back')),
 refunded_cents integer not null default 0 check(refunded_cents between 0 and 10000),
 provider_updated_at timestamptz,
 refund_key uuid, provider_refund_id text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_id,request_key)
);
create table payment_test_private.events (
 event_key text primary key check(length(event_key) between 1 and 200),
 order_id uuid not null references payment_test_private.orders(id) on delete cascade,
 payment_id text not null, state text not null, received_at timestamptz not null default now()
);
alter table payment_test_private.orders enable row level security;
alter table payment_test_private.events enable row level security;
revoke all on all tables in schema payment_test_private from public,anon,authenticated,service_role;

-- Internal RPC. Payloads are built exclusively by a server with the service key.
create function public.mp_test_store(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o payment_test_private.orders; fresh boolean:=false; next_state text; stamp timestamptz; refunded integer;
begin
 if p_action='create' then
   insert into payment_test_private.orders(owner_id,seller_id,request_key)
   values((p_payload->>'owner')::uuid,p_payload->>'seller',(p_payload->>'requestKey')::uuid)
   on conflict(owner_id,request_key) do nothing returning * into o;
   fresh:=found;
   if not fresh then select * into strict o from payment_test_private.orders where owner_id=(p_payload->>'owner')::uuid and request_key=(p_payload->>'requestKey')::uuid; end if;
   if o.seller_id is distinct from p_payload->>'seller' then raise exception 'Seller mismatch'; end if;
   return to_jsonb(o)||jsonb_build_object('fresh',fresh);
 elsif p_action='list' then
   return coalesce((select jsonb_agg(to_jsonb(q)) from (select * from payment_test_private.orders where owner_id=(p_payload->>'owner')::uuid order by created_at desc,id limit 20) q),'[]'::jsonb);
 elsif p_action='find' then
   select * into o from payment_test_private.orders where id=(p_payload->>'id')::uuid;
   return case when found then to_jsonb(o) else null end;
 end if;
 select * into o from payment_test_private.orders where id=(p_payload->>'id')::uuid for update;
 if not found then raise exception 'Order not found'; end if;
 if p_action='get' then
   if o.owner_id is distinct from (p_payload->>'owner')::uuid then raise exception 'Order not found'; end if;
 elsif p_action='preference' then
   if o.preference_id is not null then raise exception 'Preference already attached'; end if;
   update payment_test_private.orders set preference_id=p_payload->>'preference',checkout_url=p_payload->>'url',state=case when state='creating' then 'pending' else state end,updated_at=now() where id=o.id returning * into o;
 elsif p_action='apply' then
   if not p_payload ?& array['liveMode','amountCents','currency','seller','updatedAt','refundedCents','state','paymentId','eventKey'] then raise exception 'Incomplete payment'; end if;
   if p_payload->'liveMode' is distinct from 'false'::jsonb or (p_payload->>'amountCents')::integer is distinct from o.amount_cents
    or p_payload->>'currency' is distinct from o.currency or p_payload->>'seller' is distinct from o.seller_id then raise exception 'Payment mismatch'; end if;
   if exists(select 1 from payment_test_private.events where event_key=p_payload->>'eventKey') then return to_jsonb(o); end if;
   stamp:=(p_payload->>'updatedAt')::timestamptz;
   refunded:=(p_payload->>'refundedCents')::integer;
   next_state:=p_payload->>'state';
   if stamp is null or stamp>now()+interval '1 minute' or refunded is null or refunded<0 or refunded>o.amount_cents
     or next_state is null or next_state not in ('pending','in_process','approved','rejected','cancelled','refunded','charged_back')
     or coalesce(p_payload->>'paymentId','')!~'^[0-9]{1,25}$' then raise exception 'Invalid payment'; end if;
   if o.payment_id is not null and o.payment_id<>p_payload->>'paymentId' then
     if next_state in ('pending','in_process','rejected','cancelled') then
       insert into payment_test_private.events(event_key,order_id,payment_id,state) values(p_payload->>'eventKey',o.id,p_payload->>'paymentId','ignored_other_attempt');
       return to_jsonb(o);
     elsif o.state not in ('pending','in_process','rejected','cancelled') then
       raise exception 'Payment attempt requires reconciliation';
     end if;
   end if;
   if o.provider_updated_at is not null and stamp<o.provider_updated_at then return to_jsonb(o); end if;
   if refunded<o.refunded_cents then return to_jsonb(o); end if;
   if o.state in ('refunded','charged_back') and next_state<>o.state then return to_jsonb(o); end if;
   if o.state='approved' and next_state in ('pending','in_process','rejected','cancelled') then return to_jsonb(o); end if;
   if next_state='refunded' and refunded<>o.amount_cents then raise exception 'Unconfirmed full refund'; end if;
   if refunded=o.amount_cents then next_state:='refunded'; elsif refunded>0 and next_state<>'charged_back' then next_state:='partially_refunded'; end if;
   update payment_test_private.orders set payment_id=p_payload->>'paymentId',state=next_state,refunded_cents=refunded,
      provider_updated_at=stamp,updated_at=now() where id=o.id returning * into o;
   insert into payment_test_private.events(event_key,order_id,payment_id,state) values(p_payload->>'eventKey',o.id,o.payment_id,o.state);
 elsif p_action='reserve_refund' then
   if o.state<>'approved' or o.refunded_cents<>0 or o.payment_id is null then raise exception 'Full refund not available'; end if;
   update payment_test_private.orders set refund_key=coalesce(refund_key,gen_random_uuid()),updated_at=now() where id=o.id returning * into o;
 elsif p_action='save_refund' then
   if o.refund_key is null or p_payload->>'refundKey'<>o.refund_key::text then raise exception 'Refund mismatch'; end if;
   if o.provider_refund_id is not null and o.provider_refund_id<>p_payload->>'refundId' then raise exception 'Refund mismatch'; end if;
   update payment_test_private.orders set provider_refund_id=p_payload->>'refundId',updated_at=now() where id=o.id returning * into o;
 else raise exception 'Invalid store action';
 end if;
 return to_jsonb(o);
end $$;
revoke all on function public.mp_test_store(text,jsonb) from public,anon,authenticated;
grant execute on function public.mp_test_store(text,jsonb) to service_role;
commit;
