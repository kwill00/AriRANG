import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHmac } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { createLifecycleHandler } from '../supabase/functions/mercadopago-checkout-test/lifecycle.ts'
import { createWebhookHandler } from '../supabase/functions/mercadopago-webhook-test/handler.ts'
import { testReturn } from '../supabase/functions/mercadopago-return-test/handler.ts'

const db=new PGlite()
const user='00000000-0000-4000-8000-000000000001', other='00000000-0000-4000-8000-000000000002'
const requestId='00000000-0000-4000-8000-000000000011'
const config={accessToken:'APP_USR-fixture-only',projectRef:'abcdefghijklmnopqrst',supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',anonKey:'public-fixture',origin:'http://localhost:5187',notificationUrl:'https://abcdefghijklmnopqrst.supabase.co/functions/v1/mercadopago-webhook-test'}
const secret='fixture-webhook-secret'
before(async()=>{
 await db.exec(fs.readFileSync('tests/helpers/supabase-fixture.sql','utf8'))
 await db.query('insert into auth.users(id) values($1),($2)',[user,other])
 await db.exec(fs.readFileSync('supabase/migrations/202610270001_mercadopago_pruebas.sql','utf8'))
})
after(()=>db.close())
async function scenario(run){await db.exec('begin');try{await run()}finally{await db.exec('rollback')}}
async function store(action,payload){
 await db.exec('savepoint rpc_call')
 try{return (await db.query('select public.mp_test_store($1,$2::jsonb) as value',[action,JSON.stringify(payload)])).rows[0].value}
 catch(error){await db.exec('rollback to savepoint rpc_call');throw error}
 finally{await db.exec('release savepoint rpc_call')}
}
function fixture(options={}){
 const calls=[],refunds=new Map()
 let reference='',payment={id:123,live_mode:false,currency_id:'ARS',transaction_amount:100,transaction_amount_refunded:0,collector_id:42,status:'pending',date_last_updated:new Date(Date.now()-10000).toISOString()}
 const transport=async(url,init={})=>{
  calls.push({url,init})
  if(url.endsWith('/auth/v1/user'))return Response.json({id:options.user??user},{status:options.noAuth?401:200})
  if(url.endsWith('/rpc/es_admin'))return Response.json(!options.nonAdmin)
  if(url.endsWith('/rpc/privacy_access_allowed'))return Response.json(!options.minor)
  if(url.endsWith('/users/me'))return Response.json({id:42,site_id:options.country??'MLA',tags:options.realSeller?[]:['test_user']})
  if(url.endsWith('/checkout/preferences')){
   const body=JSON.parse(init.body);reference=body.external_reference
   assert.equal(body.items[0].unit_price,100);assert.equal(body.marketplace_fee,undefined)
   assert.equal(body.notification_url,config.notificationUrl)
   assert.equal(body.back_urls.success,config.supabaseUrl+'/functions/v1/mercadopago-return-test')
   if(options.preferenceTimeout)throw new Error('Simulated ambiguous creation')
   return Response.json({id:'preference-fixture',collector_id:42,init_point:'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=fixture'})
  }
  if(url.endsWith('/v1/payments/123/refunds')){
   const key=init.headers['X-Idempotency-Key'];assert.match(key,/^[0-9a-f-]{36}$/)
   if(!refunds.has(key))refunds.set(key,{id:456,payment_id:123,amount:100,status:'approved'})
   if(options.refundTimeout){options.refundTimeout=false;throw new Error('Simulated lost response PRIVATE')}
   payment={...payment,status:'refunded',transaction_amount_refunded:100,date_last_updated:new Date().toISOString()}
   return Response.json(refunds.get(key))
  }
  if(url.endsWith('/v1/payments/123'))return Response.json({...payment,external_reference:reference,...options.payment})
  throw new Error('Unexpected external request')
 }
 const handler=createLifecycleHandler(config,transport,store)
 const webhook=createWebhookHandler({...config,webhookSecret:secret},store,transport)
 const call=(body)=>handler(new Request('http://localhost/checkout',{method:'POST',headers:{origin:config.origin,authorization:'Bearer synthetic-session'},body:JSON.stringify(body)}))
 const signed=(overrides={})=>{
  const timestamp=String(Math.floor(Date.now()/1000)),requestId='fixture-request'
  const digest=createHmac('sha256',secret).update(`id:123;request-id:${requestId};ts:${timestamp};`).digest('hex')
  return new Request('http://localhost/webhook?data.id=123',{method:'POST',headers:{'x-request-id':requestId,'x-signature':`ts=${timestamp},v1=${digest}`,...overrides},body:JSON.stringify({type:'payment',data:{id:'123'},live_mode:false})})
 }
 return {options,calls,refunds,call,webhook,signed,setPayment:values=>{payment={...payment,...values}}}
}

test('persistent checkout reuses request identity, records no split and can recover history across sessions',()=>scenario(async()=>{
 const f=fixture(),first=await f.call({action:'create',requestId}),order=await first.json()
 assert.equal(first.status,200);assert.equal(order.splitApplied,false)
 const again=await (await f.call({action:'create',requestId})).json()
 assert.equal(again.orderId,order.orderId)
 assert.equal(f.calls.filter(x=>x.url.endsWith('/checkout/preferences')).length,1)
 assert.equal((await (await f.call({action:'list'})).json()).orders[0].orderId,order.orderId)
 assert.equal((await f.call({action:'create',requestId,amount:1})).status,400)
 f.options.user=other
 assert.equal((await f.call({action:'status',orderId:order.orderId})).status,502)
 assert.deepEqual((await (await f.call({action:'list'})).json()).orders,[])
}))
test('ambiguous preference creation is not automatically duplicated',()=>scenario(async()=>{
 const f=fixture({preferenceTimeout:true})
 assert.equal((await f.call({action:'create',requestId})).status,502)
 assert.equal((await f.call({action:'create',requestId})).status,409)
 assert.equal(f.calls.filter(x=>x.url.endsWith('/checkout/preferences')).length,1)
}))
test('anonymous, minor, non-admin and real sellers cannot create a sandbox checkout',()=>scenario(async()=>{
 for(const options of [{noAuth:true},{minor:true},{nonAdmin:true},{realSeller:true},{country:'MLB'}]){
  const f=fixture(options);assert.ok((await f.call({action:'create',requestId})).status>=400)
  assert.equal(f.calls.some(x=>x.url.endsWith('/checkout/preferences')),false)
 }
}))
test('webhook signature, freshness and signed query identity precede provider and database access',()=>scenario(async()=>{
 const f=fixture()
 for(const headers of [{'x-signature':'ts=1,v1=bad'},{'x-signature':`ts=1000000000,v1=${'0'.repeat(64)}`},{'x-request-id':'changed'}])assert.equal((await f.webhook(f.signed(headers))).status,401)
 assert.equal(f.calls.length,0)
 const old=String(Math.floor(Date.now()/1000)-601)
 const digest=createHmac('sha256',secret).update(`id:123;request-id:fixture-request;ts:${old};`).digest('hex')
 assert.equal((await f.webhook(f.signed({'x-signature':`ts=${old},v1=${digest}`}))).status,401)
}))
test('verified notifications persist once, stale events cannot undo approval and full refund cannot resurrect',()=>scenario(async()=>{
 const f=fixture();const order=await (await f.call({action:'create',requestId})).json()
 f.setPayment({status:'approved',date_last_updated:new Date(Date.now()-2000).toISOString()})
 assert.equal((await f.webhook(f.signed())).status,200)
 assert.equal((await f.webhook(f.signed())).status,200)
 assert.equal((await db.query('select count(*)::integer as n from payment_test_private.events')).rows[0].n,1)
 let state=await (await f.call({action:'status',orderId:order.orderId})).json();assert.equal(state.status,'approved')
 f.setPayment({status:'pending',date_last_updated:new Date(Date.now()-8000).toISOString()})
 state=await (await f.call({action:'verify',orderId:order.orderId,paymentId:'123'})).json();assert.equal(state.status,'approved')
 f.setPayment({status:'refunded',transaction_amount_refunded:100,date_last_updated:new Date(Date.now()-1000).toISOString()})
 state=await (await f.call({action:'verify',orderId:order.orderId,paymentId:'123'})).json();assert.equal(state.status,'refunded')
 f.setPayment({status:'approved',transaction_amount_refunded:0,date_last_updated:new Date().toISOString()})
 state=await (await f.call({action:'verify',orderId:order.orderId,paymentId:'123'})).json();assert.equal(state.status,'refunded')
}))
test('provider invariants prevent forged status, live payments, wrong amounts, currency, receiver and reference',()=>scenario(async()=>{
 const f=fixture();const order=await (await f.call({action:'create',requestId})).json()
 for(const payment of [{live_mode:true},{transaction_amount:1},{currency_id:'USD'},{collector_id:7},{external_reference:'foreign'},{id:999},{transaction_amount_refunded:-1}]){
  f.options.payment=payment
  assert.equal((await f.call({action:'verify',orderId:order.orderId,paymentId:'123'})).status,502)
 }
 assert.equal((await f.call({action:'status',orderId:order.orderId})).status,200)
 assert.equal((await db.query('select count(*)::integer as n from payment_test_private.events')).rows[0].n,0)
}))
test('full refund persists idempotency through a lost response and confirms provider state only',()=>scenario(async()=>{
 const f=fixture({refundTimeout:true});const order=await (await f.call({action:'create',requestId})).json()
 f.setPayment({status:'approved',date_last_updated:new Date(Date.now()-1000).toISOString()})
 await f.call({action:'verify',orderId:order.orderId,paymentId:'123'})
 assert.equal((await f.call({action:'refund',orderId:order.orderId,confirmation:'no'})).status,400)
 assert.equal((await f.call({action:'refund',orderId:order.orderId,confirmation:'REEMBOLSAR PRUEBA'})).status,502)
 const retry=await f.call({action:'refund',orderId:order.orderId,confirmation:'REEMBOLSAR PRUEBA'})
 assert.equal(retry.status,200);assert.equal((await retry.json()).status,'refunded')
 assert.equal(f.refunds.size,1)
 const keys=f.calls.filter(x=>x.url.endsWith('/refunds')).map(x=>x.init.headers['X-Idempotency-Key'])
 assert.equal(keys.length,2);assert.equal(keys[0],keys[1])
 assert.equal((await f.call({action:'refund',orderId:order.orderId,confirmation:'REEMBOLSAR PRUEBA'})).status,200)
 assert.equal(f.calls.filter(x=>x.url.endsWith('/refunds')).length,2)
}))
test('ledger RPC and private tables cannot be used by browser roles',()=>scenario(async()=>{
 for(const role of ['anon','authenticated']){
  await db.exec(`set local role ${role}`)
  assert.equal((await db.query("select has_function_privilege(current_user,'public.mp_test_store(text,jsonb)','execute') as allowed")).rows[0].allowed,false)
  assert.equal((await db.query("select has_schema_privilege(current_user,'payment_test_private','usage') as allowed")).rows[0].allowed,false)
  await db.exec('reset role')
 }
}))
test('known production project is refused before any authentication, store or provider call',async()=>{
 let calls=0
 const denied=createLifecycleHandler({...config,supabaseUrl:'https://buhgdsnxmmoqshvoyyth.supabase.co',projectRef:'buhgdsnxmmoqshvoyyth'},async()=>{calls++;throw new Error('Unexpected call')},store)
 assert.equal((await denied(new Request('http://localhost/test',{method:'POST',headers:{origin:config.origin,authorization:'Bearer fixture'},body:'{}'}))).status,503)
 const webhook=createWebhookHandler({...config,supabaseUrl:'https://buhgdsnxmmoqshvoyyth.supabase.co',projectRef:'buhgdsnxmmoqshvoyyth',webhookSecret:secret},store,async()=>{calls++;throw new Error('Unexpected call')})
 assert.equal((await webhook(new Request('http://localhost/webhook',{method:'POST'}))).status,503)
 assert.equal(calls,0)
})
test('return page ignores untrusted approval parameters and contains no executable content',async()=>{
 const response=testReturn(new Request('https://fixture/return?status=approved&payment_id=%3Cscript%3E'))
 const html=await response.text()
 assert.equal(response.status,200);assert.equal(html.includes('<script>'),false)
 assert.ok(html.includes('no confirma ningún pago'))
 assert.equal(response.headers.get('cache-control'),'no-store')
 assert.equal(testReturn(new Request('https://fixture/return',{method:'POST'})).status,405)
})
test('webhook persistence failures request delivery retry and never expose private errors',()=>scenario(async()=>{
 const f=fixture();await f.call({action:'create',requestId})
 const broken=createWebhookHandler({...config,webhookSecret:secret},async()=>{throw new Error('PRIVATE_SERVICE_KEY')},async(url,init)=>{
  if(url.endsWith('/users/me'))return Response.json({id:42,site_id:'MLA',tags:['test_user']})
  if(url.endsWith('/v1/payments/123'))return Response.json({external_reference:'armytest_00000000-0000-4000-8000-000000000022'})
  throw new Error('Unexpected request '+init?.method)
 })
 const result=await broken(f.signed());assert.equal(result.status,503);assert.equal((await result.text()).includes('PRIVATE'),false)
}))
test('partial refunds and disputes persist without enabling an incorrect full refund',()=>scenario(async()=>{
 const f=fixture();const order=await (await f.call({action:'create',requestId})).json()
 f.setPayment({status:'approved',transaction_amount_refunded:20,date_last_updated:new Date(Date.now()-1000).toISOString()})
 const partial=await (await f.call({action:'verify',orderId:order.orderId,paymentId:'123'})).json()
 assert.equal(partial.status,'partially_refunded');assert.equal(partial.refundedAmount,20)
 assert.equal((await f.call({action:'refund',orderId:order.orderId,confirmation:'REEMBOLSAR PRUEBA'})).status,409)
 f.setPayment({status:'charged_back',date_last_updated:new Date().toISOString()})
 const disputed=await (await f.call({action:'verify',orderId:order.orderId,paymentId:'123'})).json()
 assert.equal(disputed.status,'charged_back');assert.equal(f.refunds.size,0)
}))
