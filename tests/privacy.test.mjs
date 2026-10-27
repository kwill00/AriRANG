import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { makeLoader } from './helpers/load-ts.mjs'

const storage = new Map()
globalThis.localStorage = { getItem: key=>storage.get(key)??null, setItem:(key,value)=>storage.set(key,value), removeItem:key=>storage.delete(key) }
const load = makeLoader({ '../lib/supabase': {supabase:{}} })
const privacy = load('src/lib/privacy.ts')
const { translate, LocaleContext } = load('src/lib/locale.tsx')
const { messages }=load('src/lib/translations.ts')
const { extraMessages }=load('src/lib/translations-extra.ts')
const { feedbackMessages }=load('src/lib/translations-feedback.ts')
const { youthMessages }=load('src/lib/translations-youth.ts')
const { homeMessages }=load('src/lib/translations-home.ts')
const { policies }=load('src/lib/policies.ts')

test('consent fails closed for missing, malformed, stale, future or old policy records',()=>{
 for(const value of [null,'{',JSON.stringify({version:'old',savedAt:Date.now(),externalMedia:true,push:true}), JSON.stringify({...privacy.deniedConsent(),push:'true'}),JSON.stringify({...privacy.deniedConsent(),savedAt:Date.now()-181*86400000}),JSON.stringify({...privacy.deniedConsent(),savedAt:Date.now()+999999})]) {
  storage.clear();if(value)storage.set(privacy.CONSENT_KEY,value)
  assert.equal(privacy.readConsent(),null); assert.equal(privacy.permits('push'),false); assert.equal(privacy.safeAvatar('https://lh3.googleusercontent.com/photo'),undefined)
 }
})
test('independent optional purposes: accepting media never enables push',()=>{
 storage.set(privacy.CONSENT_KEY,JSON.stringify({...privacy.deniedConsent(),externalMedia:true}))
 assert.equal(privacy.permits('externalMedia'),true);assert.equal(privacy.permits('push'),false)
 assert.equal(privacy.safeAvatar('https://lh3.googleusercontent.com/photo'),'https://lh3.googleusercontent.com/photo')
})
test('avatar allowlist rejects tracking hosts, disguised hosts, scripts and credentials',()=>{
 for(const url of ['javascript:alert(1)','data:image/svg+xml,hi','http://lh3.googleusercontent.com/a','https://tracker.test/a','https://lh3.googleusercontent.com.evil.test/a','https://u:p@lh3.googleusercontent.com/a','https://lh3.googleusercontent.com:8443/a']) assert.equal(privacy.safeAvatar(url,true),undefined,url)
 assert.equal(privacy.safeAvatar('https://example.supabase.co/storage/v1/object/a',true),'https://example.supabase.co/storage/v1/object/a')
 assert.equal(privacy.safeAvatar('https://lh3.googleusercontent.com/a',false),undefined)
})
test('blocked local storage never enables optional technology',()=>{
 const previous=globalThis.localStorage
 globalThis.localStorage={getItem(){throw new Error('blocked')}}
 assert.equal(privacy.readConsent(),null);assert.equal(privacy.permits('push'),false)
 globalThis.localStorage=previous
})
test('all interface dictionaries have four nonempty translations; all policies have five languages',()=>{
 for(const [key,values] of Object.entries({...messages,...extraMessages,...feedbackMessages,...youthMessages,...homeMessages})) {
  assert.equal(values.length,4,key); for(const v of values) assert.ok(v.trim(),key)
  for(const value of values) assert.deepEqual((value.match(/\{\w+\}/g)||[]).sort(),(key.match(/\{\w+\}/g)||[]).sort(),key)
 }
 for(const language of ['es','en','ko','pt','ja']) {
  assert.equal(Object.keys(policies[language]).length,5)
  for(const paragraphs of Object.values(policies[language])) assert.ok(paragraphs.length>=3)
 }
 assert.equal(translate('user-generated text','ja'),'user-generated text')
 assert.equal(translate('Ver perfil de {nombre}','en',{nombre:'<name>'}),'View profile of <name>')
})
test('sign-in controls render in all five languages without loading Google OAuth',()=>{
 const Login=load('src/components/Login.tsx').default
 for(const language of ['es','en','ko','pt','ja']) {
  const html=renderToStaticMarkup(React.createElement(LocaleContext.Provider,{value:language},React.createElement(Login)))
  assert.ok(html.includes(translate('Iniciar sesión',language)),language)
  assert.ok(html.includes(translate('Correo electrónico',language)),language)
  assert.ok(html.includes('for="auth-email"'),language)
  assert.ok(!html.includes('Continuar con Google'))
  assert.ok(!html.includes('checked=""'))
 }
})
test('parental notice and separate required consents render without collecting child documents or DOB',()=>{
 const { AgeNotice, PolicyChoices }=load('src/components/AccessGate.tsx')
 const notice=renderToStaticMarkup(React.createElement(AgeNotice))
 assert.ok(!notice.includes('<input')); assert.ok(notice.includes('Antes de los 14'))
 const html=renderToStaticMarkup(React.createElement(PolicyChoices,{terms:false,privacy:false,onTerms(){},onPrivacy(){}}))
 assert.equal((html.match(/type="checkbox"/g)||[]).length,2)
 assert.ok(!html.includes('checked=""')); assert.ok(!html.includes('publicidad"'))
})

function accountHarness({ user = { id:'owner-id', last_sign_in_at:new Date().toISOString() }, authError=null, rpcError=null, deletionError=null }={}) {
 let handler; const calls=[]
 const client={auth:{getUser:async token=>{calls.push(['token',token]);return {data:{user},error:authError}},admin:{deleteUser:async id=>{calls.push(['delete',id]);return {error:deletionError}}}},rpc:async(name,args)=>{calls.push([name,args]);return {error:rpcError}}}
 const env={PRIVACY_APP_ORIGIN:'https://app.test',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-server-placeholder'}
 makeLoader({'npm:@supabase/supabase-js@2':{createClient:()=>client}}, {Deno:{env:{get:k=>env[k]},serve:fn=>handler=fn}})('supabase/functions/privacy-account/index.ts')
 const request=(body,options={})=>handler(new Request('https://edge.test',{method:'POST',headers:{origin:'https://app.test',authorization:'Bearer verified-token',...options.headers},body:JSON.stringify(body),...options}))
 return {request,calls,handler}
}
test('account endpoint rejects anonymous, missing origin, invalid action and malformed input',async()=>{
 const invalid=accountHarness({user:null})
 assert.equal((await invalid.request({action:'delete',confirmation:'ELIMINAR'})).status,401)
 assert.ok(!invalid.calls.some(([name])=>name==='delete'))
 const h=accountHarness()
 assert.equal((await h.request({action:'delete',confirmation:'wrong'})).status,400)
 assert.equal((await h.handler(new Request('https://edge.test',{method:'POST'}))).status,403)
 assert.ok(!h.calls.some(([name])=>name==='delete'))
})
test('unsubscribe ignores a spoofed target ID and saves only the authenticated identity',async()=>{
 const h=accountHarness();const response=await h.request({action:'unsubscribe',user_id:'victim'})
 assert.equal(response.status,200)
 assert.deepEqual(h.calls.find(([name])=>name==='privacy_unsubscribe'),['privacy_unsubscribe',{p_user_id:'owner-id'}])
})
test('unsubscribe never reports success when persistence fails',async()=>{
 const h=accountHarness({rpcError:{message:'unavailable'}})
 const response=await h.request({action:'unsubscribe'})
 assert.equal(response.status,503);assert.equal((await response.json()).ok,false)
})
test('deletion requires recent authentication and successful inventory preflight',async()=>{
 const old=accountHarness({user:{id:'owner-id',last_sign_in_at:new Date(Date.now()-11*60000).toISOString()}})
 assert.equal((await old.request({action:'delete',confirmation:'ELIMINAR'})).status,403)
 assert.ok(!old.calls.some(([name])=>name==='delete'))
 const blocked=accountHarness({rpcError:{message:'storage exists'}})
 assert.equal((await blocked.request({action:'delete',confirmation:'ELIMINAR'})).status,409)
 assert.ok(!blocked.calls.some(([name])=>name==='delete'))
})
test('deletion uses verified user identity, and a failed Auth deletion is not success',async()=>{
 const h=accountHarness()
 assert.equal((await h.request({action:'delete',confirmation:'ELIMINAR',user_id:'victim'})).status,200)
 assert.deepEqual(h.calls.find(([name])=>name==='delete'),['delete','owner-id'])
 const failed=accountHarness({deletionError:{message:'foreign key'}})
 const response=await failed.request({action:'delete',confirmation:'ELIMINAR'})
 assert.equal(response.status,409);assert.equal((await response.json()).ok,false)
})
test('parental webhook rejects forged, expired and malformed signatures before any database call',async()=>{
 let handler;let writes=0
 makeLoader({'npm:@supabase/supabase-js@2':{createClient:()=>({rpc:()=>{writes++;return {}}})}}, {Deno:{env:{get:()=> 'test-placeholder'},serve:fn=>handler=fn}})('supabase/functions/privacy-parental-event/index.ts')
 const body=JSON.stringify({id:'e',user_id:'00000000-0000-4000-8000-000000000001',decision:'verified',evidence_reference:'provider-reference'})
 for(const headers of [{},{'x-parental-timestamp':String(Date.now()),'x-parental-signature':'0'.repeat(64)},{'x-parental-timestamp':String(Date.now()-600000),'x-parental-signature':'0'.repeat(64)}]) {
  assert.equal((await handler(new Request('https://edge.test',{method:'POST',headers,body}))).status,401)
 }
 assert.equal(writes,0)
})
