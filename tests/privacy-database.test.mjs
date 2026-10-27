import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { makeLoader } from './helpers/load-ts.mjs'
const db = new PGlite()
const version='2026-10-26.2'
const ids={adult:'00000000-0000-4000-8000-000000000001',other:'00000000-0000-4000-8000-000000000002',minor:'00000000-0000-4000-8000-000000000003',unknown:'00000000-0000-4000-8000-000000000004',admin:'00000000-0000-4000-8000-000000000005'}
before(async()=>{
 await db.exec(fs.readFileSync('tests/helpers/supabase-fixture.sql','utf8'))
 // Seed legacy users/content before the registration trigger is installed.
 for(const [name,id] of Object.entries(ids)) {
  await db.query('insert into auth.users(id) values($1)',[id])
  await db.query('insert into public.perfiles(id,nombre,rol) values($1,$2,$3)',[id,name,name==='admin'?'admin':'army'])
 }
 const files=fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()
 for(const file of files) {
  try { await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8')) }
  catch(error) { throw new Error(`Migration ${file}: ${error.message}`,{cause:error}) }
 }
})
after(async()=>await db.close())
async function scenario(run) {
 await db.exec('begin')
 try { await run(db) } finally { await db.exec('rollback') }
}
async function asUser(tx,id,run,role='authenticated') {
 await tx.exec(`set local role ${role}`)
 await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id??''])
 try { return await run(tx) } finally { await tx.exec('reset role') }
}
async function ready(tx) {
 await tx.exec('update privacy_private.configuration set public_ready=true')
 for(const id of [ids.adult,ids.other,ids.admin]) await asUser(tx,id,()=>tx.query('select public.privacy_accept_adult($1,true,true)',[version]))
 await tx.query("insert into privacy_private.accounts(user_id,age_status,policy_version) values($1,'pending_parent','')",[ids.minor])
}
// A statement failure aborts a PostgreSQL transaction. Use savepoints when testing rejection.
async function rejectsStatement(tx,run,pattern) {
 await tx.exec('savepoint expected_rejection')
 try { await assert.rejects(run,pattern) }
 finally { await tx.exec('rollback to savepoint expected_rejection') }
}
test('all repository migrations execute on the disposable PostgreSQL fixture; defaults stay closed',()=>scenario(async tx=>{
 assert.equal((await tx.query('select public.privacy_registration_ready() as ready')).rows[0].ready,false)
 await asUser(tx,ids.adult,async()=>assert.equal((await tx.query('select public.privacy_access_allowed() as allowed')).rows[0].allowed,false))
}))
test('adult acceptance is required; a known minor cannot self-upgrade',()=>scenario(async tx=>{
 await ready(tx)
 await asUser(tx,ids.adult,async()=>assert.equal((await tx.query('select public.privacy_access_allowed() as allowed')).rows[0].allowed,true))
 await asUser(tx,ids.minor,()=>rejectsStatement(tx,()=>tx.query('select public.privacy_accept_adult($1,true,true)',[version]),/Parental review/))
 await asUser(tx,ids.unknown,()=>rejectsStatement(tx,()=>tx.query('select public.privacy_accept_adult($1,false,true)',[version]),/Acceptance required/))
}))
test('minor/unreviewed users cannot write content or use privileged RPCs',()=>scenario(async tx=>{
 await ready(tx)
 for(const id of [ids.minor,ids.unknown]) {
  await asUser(tx,id,async()=>{
   await rejectsStatement(tx,()=>tx.query("insert into public.comunidad_publicaciones(autor_id,titulo,contenido,tipo) values($1,'A title','A sufficiently long message','publicacion')",[id]),/row-level security/)
   await rejectsStatement(tx,()=>tx.query('select public.fixture_privileged_probe()'),/Access restricted/)
   await rejectsStatement(tx,()=>tx.query('select public.social_perfil($1)',[ids.adult]),/Access restricted/)
  })
 }
}))
test('adult readers cannot see legacy content of minors, including through a view or inherited anonymous grants',()=>scenario(async tx=>{
 await ready(tx)
 for(const [name,id] of Object.entries(ids)) await tx.query("insert into public.proyectos(autor_id,titulo,descripcion,estado) values($1,$2,'Description for fixture','publicado')",[id,name])
 await asUser(tx,ids.adult,async()=>{
  const rows=(await tx.query('select titulo from public.proyectos order by titulo')).rows.map(r=>r.titulo)
  assert.ok(rows.includes('adult'));assert.ok(!rows.includes('minor'));assert.ok(!rows.includes('unknown'))
  const view=(await tx.query('select titulo from public.fixture_project_view')).rows.map(r=>r.titulo)
  assert.ok(!view.includes('minor'));assert.ok(!view.includes('unknown'))
  const posts=(await tx.query('select titulo from public.comunidad_publicaciones')).rows.map(r=>r.titulo)
  assert.ok(!posts.includes('minor'));assert.ok(!posts.includes('unknown'))
 })
 await asUser(tx,null,async()=>assert.equal((await tx.query('select * from public.proyectos')).rows.length,0),'anon')
}))
test('profile visibility needs a separate consent and hides legacy visible=true',()=>scenario(async tx=>{
 await ready(tx)
 await tx.query("insert into public.social_perfiles(usuario_id,nombre,visible) values($1,'Legacy alias',false)",[ids.other])
 // Simulate a pre-existing true value, without manufacturing a consent timestamp.
 await tx.exec('alter table public.social_perfiles disable trigger army_social_visibility')
 await tx.query('update public.social_perfiles set visible=true where usuario_id=$1',[ids.other])
 await tx.exec('alter table public.social_perfiles enable trigger army_social_visibility')
 await asUser(tx,ids.adult,async()=>assert.equal((await tx.query('select public.social_perfil($1) as profile',[ids.other])).rows[0].profile,null))
 await asUser(tx,ids.other,async()=>{
  await rejectsStatement(tx,()=>tx.query('update public.social_perfiles set visible=true where usuario_id=$1',[ids.other]),/Explicit profile visibility/)
  await tx.query('update public.social_perfiles set visible=true,visibility_consent_version=$1 where usuario_id=$2',[version,ids.other])
 })
 await asUser(tx,ids.adult,async()=>assert.equal((await tx.query('select public.social_perfil($1) as profile',[ids.other])).rows[0].profile.nombre,'Legacy alias'))
}))
test('parental events require service role, reject replay, and verification alone never opens minor access',()=>scenario(async tx=>{
 await ready(tx)
 await asUser(tx,ids.adult,()=>rejectsStatement(tx,()=>tx.query("select public.privacy_parental_event('event-forged',$1,'verified','reference')",[ids.minor]),/permission denied/))
 await asUser(tx,null,async()=>{
  await tx.query("select public.privacy_parental_event('event-real',$1,'verified','provider-reference')",[ids.minor])
  await rejectsStatement(tx,()=>tx.query("select public.privacy_parental_event('event-real',$1,'verified','provider-reference')",[ids.minor]),/duplicate key/)
 },'service_role')
 await asUser(tx,ids.minor,async()=>assert.equal((await tx.query('select public.privacy_access_allowed() as allowed')).rows[0].allowed,false))
 await asUser(tx,null,async()=>{
  await tx.query("select public.privacy_parental_event('event-revoked',$1,'revoked','reference')",[ids.minor])
 },'service_role')
 // Re-selecting an age band must not reopen a revoked parental case.
 await asUser(tx,ids.minor,()=>tx.query('select public.privacy_restrict_minor()'))
 await asUser(tx,null,()=>rejectsStatement(tx,()=>tx.query("select public.privacy_parental_event('late-event',$1,'verified','reference')",[ids.minor]),/revoked case/),'service_role')
}))
test('privacy schemas and service-only deletion/marketing RPCs are inaccessible to clients',()=>scenario(async tx=>{
 await ready(tx)
 await asUser(tx,ids.adult,async()=>{
  await rejectsStatement(tx,()=>tx.query('select * from privacy_private.accounts'),/permission denied/)
  await rejectsStatement(tx,()=>tx.query('select public.privacy_unsubscribe($1)',[ids.other]),/permission denied/)
  await rejectsStatement(tx,()=>tx.query('select public.privacy_deletion_preflight($1)',[ids.other]),/permission denied/)
 })
 await asUser(tx,null,()=>tx.query('select public.privacy_unsubscribe($1)',[ids.adult]),'service_role')
 assert.equal((await tx.query('select promotional_email from privacy_private.email_preferences where user_id=$1',[ids.adult])).rows[0].promotional_email,false)
}))
test('deletion preflight refuses unreviewed configuration and user-owned storage',()=>scenario(async tx=>{
 await ready(tx)
 await rejectsStatement(tx,()=>tx.query('select public.privacy_deletion_preflight($1)',[ids.adult]),/not been reviewed/)
 await tx.exec('update privacy_private.configuration set deletion_reviewed=true')
 await tx.query('select public.privacy_deletion_preflight($1)',[ids.adult])
 await tx.query('insert into storage.objects(owner_id) values($1)',[ids.adult])
 await rejectsStatement(tx,()=>tx.query('select public.privacy_deletion_preflight($1)',[ids.adult]),/Storage cleanup/)
}))
test('registration trigger blocks minor or incomplete metadata independently of the browser',()=>scenario(async tx=>{
 await ready(tx)
 await rejectsStatement(tx,()=>tx.query('insert into auth.users(id,raw_user_meta_data) values(gen_random_uuid(),$1)',[{age_band:'minor',policy_version:version,terms_accepted:true,privacy_acknowledged:true}]),/Registration is restricted/)
 await rejectsStatement(tx,()=>tx.query("insert into auth.users(id) values(gen_random_uuid())"),/Registration is restricted/)
 await tx.query('insert into auth.users(id,raw_user_meta_data) values(gen_random_uuid(),$1)',[{age_band:'adult',policy_version:version,terms_accepted:true,privacy_acknowledged:true}])
}))
test('signed synthetic parental callback reaches SQL, rejects replay and tampering, and enforces revocation',()=>scenario(async tx=>{
 await ready(tx)
 let handler
 const secret='local-fixture-secret-for-hmac-tests-only'
 const client={rpc:async(name,args)=>{
  assert.equal(name,'privacy_parental_event')
  await tx.exec('savepoint callback_write')
  try {
   await asUser(tx,null,()=>tx.query('select public.privacy_parental_event($1,$2,$3,$4)',[args.p_event_id,args.p_user_id,args.p_decision,args.p_evidence_reference]),'service_role')
   await tx.exec('release savepoint callback_write');return {error:null}
  } catch(error) {await tx.exec('rollback to savepoint callback_write');return {error:{code:error.code}}}
 }}
 const values={PARENTAL_WEBHOOK_SECRET:secret,SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-only'}
 makeLoader({'npm:@supabase/supabase-js@2':{createClient:()=>client}}, {Deno:{env:{get:k=>values[k]},serve:fn=>handler=fn}})('supabase/functions/privacy-parental-event/index.ts')
 async function signedRequest(event,tamper=false) {
  const timestamp=String(Date.now()),body=JSON.stringify(event)
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+body))).toString('hex')
  return handler(new Request('https://fixture.invalid',{method:'POST',headers:{'x-parental-timestamp':timestamp,'x-parental-signature':signature},body:tamper?body+' ':body}))
 }
 const event={id:'signed-fixture',user_id:ids.minor,decision:'verified',evidence_reference:'synthetic-provider-reference'}
 assert.equal((await signedRequest(event,true)).status,401)
 assert.equal((await signedRequest(event)).status,200)
 assert.equal((await signedRequest(event)).status,409)
 assert.equal((await tx.query('select age_status from privacy_private.accounts where user_id=$1',[ids.minor])).rows[0].age_status,'parent_verified')
 await asUser(tx,ids.minor,async()=>assert.equal((await tx.query('select public.privacy_access_allowed() as allowed')).rows[0].allowed,false))
 assert.equal((await signedRequest({...event,id:'signed-revoke',decision:'revoked'})).status,200)
 assert.equal((await tx.query('select age_status from privacy_private.accounts where user_id=$1',[ids.minor])).rows[0].age_status,'revoked')
}))
test('fixture account deletion cascades owned records and denies a stale user claim afterwards',()=>scenario(async tx=>{
 await ready(tx)
 await tx.query("insert into public.viajes(usuario_id,destino) values($1,'Fixture destination')",[ids.adult])
 await tx.query("insert into public.proyectos(autor_id,titulo,descripcion,estado) values($1,'Fixture project','Long fixture description','publicado')",[ids.adult])
 await tx.query('insert into public.solicitudes_organizadora(usuario_id) values($1)',[ids.adult])
 await tx.query("insert into public.social_perfiles(usuario_id,nombre,visible) values($1,'Fixture alias',false)",[ids.adult])
 await tx.query('select public.privacy_unsubscribe($1)',[ids.adult])
 await tx.exec('update privacy_private.configuration set deletion_reviewed=true')
 await tx.query('select public.privacy_deletion_preflight($1)',[ids.adult])
 await tx.query('delete from auth.users where id=$1',[ids.adult])
 for(const [table,column] of [['public.perfiles','id'],['public.viajes','usuario_id'],['public.proyectos','autor_id'],['public.solicitudes_organizadora','usuario_id'],['public.comunidad_publicaciones','autor_id'],['public.social_perfiles','usuario_id'],['privacy_private.accounts','user_id'],['privacy_private.email_preferences','user_id']]) {
  assert.equal((await tx.query(`select count(*)::int as n from ${table} where ${column}=$1`,[ids.adult])).rows[0].n,0,table)
 }
 assert.equal((await tx.query('select count(*)::int as n from auth.users where id=$1',[ids.other])).rows[0].n,1)
 await asUser(tx,ids.adult,async()=>assert.equal((await tx.query('select public.privacy_access_allowed() as allowed')).rows[0].allowed,false))
}))
async function enableLimitedMinor(tx,scopes=['private_planner','moderated_posts']) {
 await tx.exec('update privacy_private.configuration set minors_enabled=true')
 await asUser(tx,null,()=>tx.query('select public.privacy_parental_authorize($1,$2,$3,$4,$5,$6)',[
  'scoped-fixture',ids.minor,'verified-provider-reference',version,scopes,new Date(Date.now()+86400000).toISOString(),
 ]),'service_role')
}
test('scoped, current parental authorization enables only the limited space when the operator enables minors',()=>scenario(async tx=>{
 await ready(tx)
 await asUser(tx,ids.minor,async()=>assert.equal((await tx.query('select public.privacy_access_mode() as mode')).rows[0].mode,'restricted'))
 await enableLimitedMinor(tx)
 await asUser(tx,ids.minor,async()=>{
  assert.equal((await tx.query('select public.privacy_access_mode() as mode')).rows[0].mode,'minor_limited')
  assert.equal((await tx.query('select public.privacy_access_allowed() as allowed')).rows[0].allowed,false)
  await rejectsStatement(tx,()=>tx.query('select public.social_perfil($1)',[ids.adult]),/Access restricted/)
  await rejectsStatement(tx,()=>tx.query('select public.social_guardar_push($1,$2,$3)',['https://fcm.googleapis.com/fake','x'.repeat(90),'x'.repeat(22)]),/Access restricted/)
 })
 await tx.exec("update privacy_private.accounts set guardian_consent_expires_at=now()-interval '1 second' where age_status='parent_verified'")
 await asUser(tx,ids.minor,async()=>assert.equal((await tx.query('select public.privacy_access_mode() as mode')).rows[0].mode,'restricted'))
}))
test('planner-only parental scope does not authorize community submissions and clients cannot grant themselves scopes',()=>scenario(async tx=>{
 await ready(tx);await enableLimitedMinor(tx,['private_planner'])
 await asUser(tx,ids.minor,async()=>{
  assert.equal((await tx.query('select public.community_safe_participant() as allowed')).rows[0].allowed,false)
  await rejectsStatement(tx,()=>tx.query("select public.community_submit_safe('Una idea','Una descripción suficiente','2026-10-26')"),/Access restricted/)
  await rejectsStatement(tx,()=>tx.query('select public.privacy_parental_authorize($1,$2,$3,$4,$5,$6)',['forged',ids.minor,'fake',version,['private_planner','moderated_posts'],new Date(Date.now()+86400000).toISOString()]),/permission denied/)
 })
}))
test('minor proposals remain pending until an independent administrator approves, then can be withdrawn',()=>scenario(async tx=>{
 await ready(tx);await enableLimitedMinor(tx)
 let postId
 await asUser(tx,ids.minor,async()=>{
  postId=(await tx.query("select public.community_submit_safe('Una propuesta','Un concierto para todas las personas','2026-10-26') as id")).rows[0].id
  assert.equal((await tx.query('select * from public.community_safe_feed()')).rows.length,0)
  assert.equal((await tx.query('select estado from public.comunidad_revision_previa where id=$1',[postId])).rows[0].estado,'pendiente')
  await rejectsStatement(tx,()=>tx.query("update public.comunidad_revision_previa set estado='aprobada' where id=$1",[postId]),/permission denied/)
  await rejectsStatement(tx,()=>tx.query("select public.community_review_safe($1,true,'Autoaprobación')",[postId]),/Admin required/)
 })
 await asUser(tx,ids.admin,async()=>{
  await tx.query("select public.community_review_safe($1,true,'Contenido revisado y apto')",[postId])
 })
 await asUser(tx,ids.minor,async()=>{
  const rows=(await tx.query('select * from public.community_safe_feed()')).rows
  assert.equal(rows.length,1);assert.equal(rows[0].autor_id,undefined)
 })
 await asUser(tx,ids.admin,()=>tx.query("select public.community_review_safe($1,false,'Retirar por revisión posterior')",[postId]))
 await asUser(tx,ids.minor,async()=>assert.equal((await tx.query('select * from public.community_safe_feed()')).rows.length,0))
}))
test('server requires conduct acceptance, rejects contact sharing, and caps submissions even without the UI',()=>scenario(async tx=>{
 await ready(tx);await enableLimitedMinor(tx)
 await asUser(tx,ids.minor,async()=>{
  await rejectsStatement(tx,()=>tx.query("select public.community_submit_safe('Una idea','Una descripción suficiente','old')"),/Conduct acceptance/)
  for(const text of ['Mi correo es prueba@example.invalid','Visiten https://example.invalid/','Mi teléfono es +54 11 5555 5555']) await rejectsStatement(tx,()=>tx.query('select public.community_submit_safe($1,$2,$3)',['Una propuesta',text,'2026-10-26']),/contact details/)
  for(let i=0;i<5;i++) await tx.query("select public.community_submit_safe('Una idea','Una descripción suficiente','2026-10-26')")
  await rejectsStatement(tx,()=>tx.query("select public.community_submit_safe('Otra idea','Una descripción suficiente','2026-10-26')"),/Daily submission limit/)
 })
}))
test('trusted admission tickets allow a new minor account without false adult metadata and cannot be reused',()=>scenario(async tx=>{
 await ready(tx)
 await rejectsStatement(tx,()=>tx.query('select public.privacy_issue_minor_admission($1,$2,$3,$4)',['verified-reference',version,['private_planner'],new Date(Date.now()+86400000).toISOString()]),/not ready/)
 await tx.exec('update privacy_private.configuration set minors_enabled=true')
 let ticket
 await asUser(tx,null,async()=>{
  ticket=(await tx.query('select public.privacy_issue_minor_admission($1,$2,$3,$4) as ticket',['verified-reference',version,['private_planner'],new Date(Date.now()+86400000).toISOString()])).rows[0].ticket
 },'service_role')
 const newId='00000000-0000-4000-8000-000000000009'
 await tx.query('insert into auth.users(id,raw_app_meta_data) values($1,$2)',[newId,{army_minor_admission:ticket}])
 await asUser(tx,newId,async()=>{
  assert.equal((await tx.query('select public.privacy_access_mode() as mode')).rows[0].mode,'minor_limited')
  assert.equal((await tx.query('select public.privacy_access_allowed() as allowed')).rows[0].allowed,false)
 })
 await rejectsStatement(tx,()=>tx.query('insert into auth.users(id,raw_app_meta_data) values(gen_random_uuid(),$1)',[{army_minor_admission:ticket}]),/Invalid minor admission/)
 await asUser(tx,ids.unknown,()=>rejectsStatement(tx,()=>tx.query('select public.privacy_issue_minor_admission($1,$2,$3,$4)',['fake',version,['private_planner'],new Date(Date.now()+86400000).toISOString()]),/permission denied/))
}))
test('safe community reports are private, idempotent and visible to independent reviewers',()=>scenario(async tx=>{
 await ready(tx);await enableLimitedMinor(tx)
 let postId
 await asUser(tx,ids.other,async()=>{ postId=(await tx.query("select public.community_submit_safe('Una idea','Una propuesta con lenguaje respetuoso','2026-10-26') as id")).rows[0].id })
 await asUser(tx,ids.admin,()=>tx.query("select public.community_review_safe($1,true,'Revisado sin datos privados')",[postId]))
 await asUser(tx,ids.minor,async()=>{
  await tx.query("select public.community_report_safe($1,'privacidad')",[postId])
  await tx.query("select public.community_report_safe($1,'privacidad')",[postId])
  await rejectsStatement(tx,()=>tx.query('select * from privacy_private.safe_reports'),/permission denied/)
  await rejectsStatement(tx,()=>tx.query('select public.community_report_summary($1)',[postId]),/Admin required/)
 })
 await asUser(tx,ids.admin,async()=>{
  const summary=(await tx.query('select public.community_report_summary($1) as summary',[postId])).rows[0].summary
  assert.deepEqual(summary,{privacidad:1})
  assert.equal((await tx.query("select id from public.community_review_queue('reportada')")).rows[0].id,postId)
 })
}))
test('expired admission tickets cannot create an account and can be purged without retaining a child identifier',()=>scenario(async tx=>{
 await ready(tx);await tx.exec('update privacy_private.configuration set minors_enabled=true')
 const ticket=(await tx.query('select public.privacy_issue_minor_admission($1,$2,$3,$4) as ticket',['expired-proof',version,['private_planner'],new Date(Date.now()+86400000).toISOString()])).rows[0].ticket
 await tx.query("update privacy_private.minor_admissions set ticket_expires_at=now()-interval '1 second' where ticket=$1",[ticket])
 await rejectsStatement(tx,()=>tx.query('insert into auth.users(id,raw_app_meta_data) values(gen_random_uuid(),$1)',[{army_minor_admission:ticket}]),/Invalid minor admission/)
 assert.equal((await tx.query('select public.privacy_purge_minor_admissions() as n')).rows[0].n,1)
 assert.equal((await tx.query('select count(*)::int as n from privacy_private.minor_admissions')).rows[0].n,0)
}))
async function enableTeenSelfService(tx) {
 await tx.exec('update privacy_private.configuration set minors_enabled=true,teen_self_access_enabled=true')
}
test('14–17 signup uses independent consent, without a parental event, only when the server enables it',()=>scenario(async tx=>{
 await ready(tx)
 const teenId='00000000-0000-4000-8000-000000000014'
 const metadata={age_band:'teen',policy_version:version,terms_accepted:true,privacy_acknowledged:true}
 await rejectsStatement(tx,()=>tx.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[teenId,metadata]),/Registration is restricted/)
 await enableTeenSelfService(tx)
 await tx.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[teenId,metadata])
 const account=(await tx.query('select age_status,age_band,guardian_policy_version,guardian_scopes from privacy_private.accounts where user_id=$1',[teenId])).rows[0]
 assert.equal(account.age_status,'teen_declared');assert.equal(account.age_band,'teen')
 assert.equal(account.guardian_policy_version,null);assert.deepEqual(account.guardian_scopes,[])
 assert.equal((await tx.query('select count(*)::int as n from privacy_private.parental_events where user_id=$1',[teenId])).rows[0].n,0)
 await asUser(tx,teenId,async()=>{
  assert.equal((await tx.query('select public.privacy_access_mode() as mode')).rows[0].mode,'minor_limited')
  assert.equal((await tx.query('select public.community_safe_participant() as allowed')).rows[0].allowed,true)
  assert.equal((await tx.query('select public.privacy_access_allowed() as allowed')).rows[0].allowed,false)
  await rejectsStatement(tx,()=>tx.query('select public.privacy_accept_adult($1,true,true)',[version]),/Age classification/)
 })
}))
test('existing unclassified accounts can accept as teens; known under-14 and revoked accounts cannot reclassify themselves',()=>scenario(async tx=>{
 await ready(tx);await enableTeenSelfService(tx)
 await asUser(tx,ids.unknown,async()=>{
  await rejectsStatement(tx,()=>tx.query('select public.privacy_accept_teen($1,false,true)',[version]),/Acceptance required/)
  await tx.query('select public.privacy_accept_teen($1,true,true)',[version])
  assert.equal((await tx.query('select public.privacy_access_mode() as mode')).rows[0].mode,'minor_limited')
 })
 await asUser(tx,ids.minor,()=>tx.query('select public.privacy_restrict_minor()'))
 await tx.query('update auth.users set raw_user_meta_data=$1 where id=$2',[{age_band:'teen'},ids.minor])
 await asUser(tx,ids.minor,()=>rejectsStatement(tx,()=>tx.query('select public.privacy_accept_teen($1,true,true)',[version]),/Age classification/))
 await tx.query("update privacy_private.accounts set age_status='revoked',age_band='teen' where user_id=$1",[ids.minor])
 await asUser(tx,ids.minor,()=>rejectsStatement(tx,()=>tx.query('select public.privacy_accept_teen($1,true,true)',[version]),/Age classification/))
}))
test('under-14 direct signup, incomplete teen consent and stale policy remain rejected even with teen service enabled',()=>scenario(async tx=>{
 await ready(tx);await enableTeenSelfService(tx)
 for(const metadata of [
  {age_band:'under14',policy_version:version,terms_accepted:true,privacy_acknowledged:true},
  {age_band:'teen',policy_version:version,terms_accepted:false,privacy_acknowledged:true},
  {age_band:'teen',policy_version:version,terms_accepted:true,privacy_acknowledged:false},
  {age_band:'teen',policy_version:'old',terms_accepted:true,privacy_acknowledged:true},
 ]) await rejectsStatement(tx,()=>tx.query('insert into auth.users(id,raw_user_meta_data) values(gen_random_uuid(),$1)',[metadata]),/Registration is restricted/)
}))
test('teen posts still need moderation and disabling independent teen access removes eligibility and feed visibility',()=>scenario(async tx=>{
 await ready(tx);await enableTeenSelfService(tx)
 let postId
 await asUser(tx,ids.unknown,async()=>{
  await tx.query('select public.privacy_accept_teen($1,true,true)',[version])
  postId=(await tx.query("select public.community_submit_safe('Una propuesta','Compartamos una idea creativa','2026-10-26') as id")).rows[0].id
  assert.equal((await tx.query('select * from public.community_safe_feed()')).rows.length,0)
 })
 await asUser(tx,ids.admin,()=>tx.query("select public.community_review_safe($1,true,'Propuesta revisada y apta')",[postId]))
 await asUser(tx,ids.adult,async()=>assert.equal((await tx.query('select * from public.community_safe_feed()')).rows.length,1))
 await tx.exec('update privacy_private.configuration set teen_self_access_enabled=false')
 await asUser(tx,ids.unknown,async()=>assert.equal((await tx.query('select public.privacy_access_mode() as mode')).rows[0].mode,'restricted'))
 await asUser(tx,ids.adult,async()=>assert.equal((await tx.query('select * from public.community_safe_feed()')).rows.length,0))
}))
