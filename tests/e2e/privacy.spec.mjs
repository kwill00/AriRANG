import { test, expect } from '@playwright/test'
const userId='00000000-0000-4000-8000-000000000001'
const user={id:userId,aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',user_metadata:{avatar_url:'https://lh3.googleusercontent.com/fixture'},app_metadata:{provider:'email'},created_at:'2026-10-25T00:00:00Z'}
const jwt=[{alg:'HS256',typ:'JWT'},{sub:userId,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'fixture-signature'].map((v,i)=>i===2?v:Buffer.from(JSON.stringify(v)).toString('base64url')).join('.')
async function fixtureNetwork(page,{access=true,deleteOk=false,mode=access?'adult':'restricted',teenReady=false,acceptSuccess=false}={}) {
 const calls=[]
 const proposals=[]
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url())
  if(url.origin==='http://127.0.0.1:5187') return route.continue()
  // An isolated browser, synthetic auth and an unconditional external interceptor.
  // No request in these tests reaches Supabase, Google, a processor or production.
  const path=url.pathname
  calls.push({path,method:route.request().method(),...(path.endsWith('/auth/v1/signup') ? {signup:route.request().postDataJSON()?.data} : {})})
  let body=[];let status=200
  if(path.includes('/auth/v1/token')) body={access_token:jwt,token_type:'bearer',expires_in:3600,refresh_token:'fixture-refresh-token',user}
  else if(path.includes('/auth/v1/user')) body=user
  else if(path.endsWith('/rpc/privacy_access_allowed')) body=access
  else if(path.endsWith('/rpc/privacy_access_mode')) body=mode
  else if(path.endsWith('/rpc/community_safe_participant')) body=mode==='minor_limited'
  else if(path.endsWith('/rpc/community_safe_feed')) body=[]
  else if(path.endsWith('/rpc/community_submit_safe')) {
   const values=route.request().postDataJSON()
   proposals.push({id:'safe-proposal-fixture',titulo:values.p_titulo,contenido:values.p_contenido,estado:'pendiente',nota_revision:null})
   body='safe-proposal-fixture'
  }
  else if(path.endsWith('/rest/v1/comunidad_revision_previa')) body=proposals
  else if(path.endsWith('/rpc/privacy_registration_ready')) body=false
  else if(path.endsWith('/rpc/privacy_teen_registration_ready')) body=teenReady
  else if(path.endsWith('/auth/v1/signup')) {status=400;body={msg:'Synthetic signup only',code:'fixture_only'}}
  else if(path.endsWith('/rpc/privacy_accept_adult') || path.endsWith('/rpc/privacy_accept_teen')) {
   if(acceptSuccess) {access=path.endsWith('/rpc/privacy_accept_adult');mode=access?'adult':'minor_limited';body=null}
   else {status=403;body={message:'Access restricted'}}
  }
  else if(path.endsWith('/rpc/es_admin')) body=false
  else if(path.endsWith('/rpc/social_perfil')) body={usuario_id:userId,nombre:'Alias fixture',biografia:'',visible:false,seguidores:0,siguiendo:0,suscripciones:0,donaciones:0,lo_sigo:false}
  else if(path.endsWith('/rest/v1/perfiles')) body={nombre:'Alias fixture',avatar_url:'https://lh3.googleusercontent.com/fixture',biografia:'',pais:'',rol:'army',verificada:false}
  else if(path.endsWith('/functions/v1/privacy-account')) {status=deleteOk?200:409;body={ok:deleteOk}}
  else if(path.startsWith('/auth/v1/')||path.includes('/rpc/')) body=null
  else if(!path.startsWith('/rest/v1/')) return route.abort('blockedbyclient')
  return route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)})
 })
 return calls
}
async function signIn(page) {
 await page.getByLabel('Correo electrónico',{exact:true}).fill('fixture@example.invalid')
 await page.getByLabel('Contraseña',{exact:true}).fill('fixture-password-only')
 await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click()
}
test('five languages update interface and html lang without losing form input',async({page})=>{
 await fixtureNetwork(page);await page.goto('/')
 await page.getByLabel('Correo electrónico',{exact:true}).fill('fixture@example.invalid')
 for(const [code,label] of [['en','Sign in'],['ko','로그인'],['pt','Entrar'],['ja','ログイン'],['es','Iniciar sesión']]) {
  await page.locator('#army-language').selectOption(code)
  await expect(page.locator('html')).toHaveAttribute('lang',code)
  await expect(page.locator('.auth-container h2')).toHaveText(label)
  await expect(page.locator('#auth-email')).toHaveValue('fixture@example.invalid')
 }
})
test('cookies start denied; reject persists; accepting and revoking are independent of login',async({page})=>{
 const calls=await fixtureNetwork(page);await page.goto('/')
 await page.getByRole('button',{name:'Configurar',exact:true}).click()
 for(const box of await page.locator('.privacy-banner input[type=checkbox]').all()) await expect(box).not.toBeChecked()
 await page.getByRole('button',{name:'Rechazar opcionales',exact:true}).click()
 await expect(page.locator('.privacy-banner')).toBeHidden()
 await page.reload();await expect(page.locator('.privacy-banner')).toBeHidden()
 await page.getByRole('button',{name:'Configurar privacidad',exact:true}).click()
 await page.getByRole('button',{name:'Aceptar opcionales',exact:true}).click()
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('army-privacy-v1')).push)).toBe(true)
 await page.getByRole('button',{name:'Revocar opcionales',exact:true}).click()
 const consent=await page.evaluate(()=>JSON.parse(localStorage.getItem('army-privacy-v1')))
 expect(consent.push).toBe(false);expect(consent.externalMedia).toBe(false)
 expect(calls.filter(c=>c.path.includes('social_guardar_push'))).toEqual([])
})
test('policies are accessible before login, close with Escape, and restore keyboard focus',async({page})=>{
 await fixtureNetwork(page);await page.goto('/')
 const button=page.getByRole('button',{name:'Privacidad',exact:true})
 await button.click();await expect(page.getByRole('dialog')).toBeVisible()
 await expect(page.getByRole('dialog')).toContainText('Información incompleta')
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible()
 await expect(button).toBeFocused()
})
test('minor registration has no contact fields and sends no signup request',async({page})=>{
 const calls=await fixtureNetwork(page);await page.goto('/')
 await page.getByRole('button',{name:'¿No tenés cuenta? Registrate',exact:true}).click()
 for(const band of ['under14']) {
  await page.getByRole('combobox',{name:'Edad',exact:true}).selectOption(band)
  await expect(page.locator('#auth-email')).toHaveCount(0)
  await expect(page.locator('#auth-password')).toHaveCount(0)
  await expect(page.getByRole('heading',{name:'Menores de 14 y autorización parental'})).toBeVisible()
 }
 expect(calls.filter(c=>c.path.includes('/signup'))).toEqual([])
})
test('adult registration requires separate unchecked choices and refuses an unconfigured backend',async({page})=>{
 const calls=await fixtureNetwork(page);await page.goto('/')
 await page.getByRole('button',{name:'¿No tenés cuenta? Registrate',exact:true}).click()
 await page.getByRole('combobox',{name:'Edad',exact:true}).selectOption('adult')
 const boxes=page.locator('.policy-choices input[type=checkbox]')
 await expect(boxes).toHaveCount(2)
 await expect(boxes.nth(0)).not.toBeChecked();await expect(boxes.nth(1)).not.toBeChecked()
 await expect(page.getByRole('button',{name:'Registrarme',exact:true})).toBeDisabled()
 await page.locator('#auth-email').fill('fixture@example.invalid');await page.locator('#auth-password').fill('fixture-password-only')
 await boxes.nth(0).check();await boxes.nth(1).check()
 await page.getByRole('button',{name:'Registrarme',exact:true}).click()
 await expect(page.getByRole('status')).toContainText('configuración del servidor')
 expect(calls.filter(c=>c.path.includes('/signup'))).toEqual([])
})
test('authenticated unreviewed account stays behind the access gate',async({page})=>{
 const calls=await fixtureNetwork(page,{access:false});await page.goto('/');await signIn(page)
 await expect(page.getByRole('heading',{name:'Un paso más para encontrarnos',exact:true})).toBeVisible()
 await page.getByRole('combobox',{name:'Edad',exact:true}).selectOption('under14')
 await expect(page.getByRole('heading',{name:'Menores de 14 y autorización parental'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Continuar',exact:true})).toBeDisabled()
 await expect(page.locator('.app-nav')).toHaveCount(0)
 expect(calls.some(c=>c.path.endsWith('/rpc/privacy_restrict_minor'))).toBe(true)
})
for (const age of ['adult','teen']) test(`saved ${age} acceptance removes the gate and stays accepted on reload`,async({page})=>{
 const calls=await fixtureNetwork(page,{access:false,acceptSuccess:true})
 await page.goto('/');await signIn(page)
 await expect(page.locator('.access-gate')).toBeVisible()
 await page.getByRole('combobox',{name:'Edad',exact:true}).selectOption(age)
 const boxes=page.locator('.access-gate .policy-choices input[type=checkbox]')
 await expect(boxes.nth(0)).not.toBeChecked();await expect(boxes.nth(1)).not.toBeChecked()
 await boxes.nth(0).check();await boxes.nth(1).check()
 await page.getByRole('button',{name:'Continuar',exact:true}).click()
 await expect(page.locator('.access-welcome')).toHaveCount(0)
 if(age==='adult') await expect(page.locator('.app-nav')).toBeVisible()
 else await expect(page.locator('.safe-community')).toBeVisible()
 await page.reload()
 await expect(page.locator('.access-welcome')).toHaveCount(0)
 expect(calls.filter(c=>c.path.endsWith(`/rpc/privacy_accept_${age}`))).toHaveLength(1)
})

test('failed acceptance keeps choices, supports retry and fits a small screen',async({page})=>{
 await fixtureNetwork(page,{access:false})
 await page.setViewportSize({width:320,height:900});await page.goto('/');await signIn(page)
 await page.getByRole('combobox',{name:'Edad',exact:true}).selectOption('adult')
 const boxes=page.locator('.access-gate .policy-choices input[type=checkbox]')
 await boxes.nth(0).check();await boxes.nth(1).check()
 await page.getByRole('button',{name:'Continuar',exact:true}).click()
 await expect(page.locator('.access-feedback')).toContainText('No se pudo guardar tu aceptación')
 await expect(boxes.nth(0)).toBeChecked();await expect(boxes.nth(1)).toBeChecked()
 await expect(page.locator('.access-account')).not.toHaveAttribute('open','')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
 await page.screenshot({path:test.info().outputPath('access-320.png'),fullPage:true})
 await page.getByRole('button',{name:'Volver a comprobar',exact:true}).click()
 await expect(page.locator('.access-gate')).toBeVisible()
 await expect(page.locator('.app-nav')).toHaveCount(0)
})

test('a temporary access lookup failure can be retried without accepting again',async({page})=>{
 await fixtureNetwork(page,{access:false})
 let failing=true
 await page.route('**/rpc/privacy_access_mode',route=>route.fulfill({status:failing?503:200,contentType:'application/json',body:JSON.stringify(failing?{message:'Unavailable'}:'adult')}))
 await page.goto('/');await signIn(page)
 await expect(page.locator('.access-feedback')).toContainText('No pudimos consultar tu acceso')
 failing=false
 await page.getByRole('button',{name:'Volver a comprobar',exact:true}).click()
 await expect(page.locator('.access-welcome')).toHaveCount(0)
 await expect(page.locator('.app-nav')).toBeVisible()
})

test('optional avatars are blocked, allowed explicitly, then removed immediately on revocation',async({page})=>{
 const calls=await fixtureNetwork(page);await page.goto('/');await signIn(page)
 await page.getByRole('button',{name:'👤 Mi perfil',exact:true}).click()
 await expect(page.locator('.perfil-avatar img, img.perfil-avatar')).toHaveCount(0)
 expect(calls.some(c=>c.path==='/fixture')).toBe(false)
 await page.getByRole('button',{name:'Configurar',exact:true}).click()
 await page.getByLabel('Avatares externos (opcional)',{exact:true}).check()
 await page.getByRole('button',{name:'Guardar preferencias',exact:true}).click()
 await expect(page.locator('img.perfil-avatar')).toHaveCount(1)
 await page.getByRole('button',{name:'Revocar opcionales',exact:true}).click()
 await expect(page.locator('img.perfil-avatar')).toHaveCount(0)
 await expect(page.getByLabel('Mostrar mi perfil a otras ARMY con sesión iniciada')).not.toBeChecked()
})
test('account deletion requires confirmation and never shows success after a server refusal',async({page})=>{
 await fixtureNetwork(page,{deleteOk:false});await page.goto('/');await signIn(page)
 await page.getByRole('button',{name:'👤 Mi perfil',exact:true}).click()
 const button=page.getByRole('button',{name:'Eliminar definitivamente',exact:true})
 await expect(button).toBeDisabled();await page.locator('#delete-confirm').fill('ELIMINAR');await button.click()
 await expect(page.locator('.privacy-account [role=status]')).toContainText('No se pudo completar')
 await expect(page.locator('.app-nav')).toBeVisible()
})
test('keyboard skip link and airport options remain operable without a mouse',async({page})=>{
 await fixtureNetwork(page);await page.goto('/')
 await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Saltar al contenido'})).toBeFocused()
 await page.keyboard.press('Enter');await expect(page.locator('#army-content')).toBeFocused()
 await signIn(page);await page.getByRole('button',{name:'➕ Crear viaje',exact:true}).click()
 const origin=page.getByRole('combobox',{name:'✈️ Aeropuerto de origen',exact:true})
 await origin.fill('BRC');await origin.press('ArrowDown')
 await expect(page.getByRole('option',{name:/BRC/}).first()).toBeFocused()
 await page.keyboard.press('Enter');await expect(origin).toHaveValue(/\(BRC\)/)
 await expect(origin).toBeFocused()
})
test('320px and desktop layouts keep the public controls within the viewport',async({page},info)=>{
 await fixtureNetwork(page)
 for(const width of [320,1280]) {
  await page.setViewportSize({width,height:900});await page.goto('/')
  await expect(page.getByRole('button',{name:'Rechazar opcionales',exact:true})).toBeVisible()
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)
  expect(overflow,`horizontal overflow at ${width}px`).toBe(false)
  await page.screenshot({path:info.outputPath(`privacy-${width}.png`),fullPage:true})
 }
})
test('a minor can enter the visitor planner without an account or new external requests; calculations disappear on exit',async({page})=>{
 const calls=await fixtureNetwork(page);await page.goto('/')
 await page.getByRole('button',{name:'¿No tenés cuenta? Registrate',exact:true}).click()
 await page.getByRole('combobox',{name:'Edad',exact:true}).selectOption('under14')
 await page.getByRole('button',{name:'Usar el planificador sin cuenta',exact:true}).click()
 const initialCalls=calls.length
 await expect(page.getByRole('heading',{name:'ARMY Travel para visitantes'})).toBeVisible()
 await page.getByLabel('Objetivo de ahorro (USD)',{exact:true}).fill('1000')
 await page.getByLabel('Ahorro actual (USD)',{exact:true}).fill('200')
 await page.getByLabel('Aporte semanal estimado (USD)',{exact:true}).fill('100')
 await expect(page.locator('.guest-result')).toContainText('Semanas estimadas: 8')
 expect(calls.length).toBe(initialCalls)
 await page.getByRole('button',{name:'Salir del modo visitante',exact:true}).click()
 await page.getByRole('button',{name:'Entrar como visitante',exact:true}).click()
 await expect(page.locator('#guest-goal')).toHaveValue('')
 const keys=await page.evaluate(()=>Object.keys(localStorage))
 expect(keys.every(key=>['army-language','army-privacy-v1','army-push-removal-pending'].includes(key))).toBe(true)
})
test('a server-authorized minor sees only the limited space and proposals stay pending after submission',async({page})=>{
 await fixtureNetwork(page,{access:false,mode:'minor_limited'});await page.goto('/');await signIn(page)
 await expect(page.getByRole('heading',{name:'Mi espacio protegido',exact:true})).toBeVisible()
 await expect(page.locator('.app-nav')).toHaveCount(0)
 await expect(page.getByRole('heading',{name:'Comunidad con revisión previa',exact:true})).toBeVisible()
 const form=page.locator('.safe-community form')
 await expect(form.getByRole('checkbox')).not.toBeChecked()
 await expect(form.getByRole('button',{name:'Enviar a revisión',exact:true})).toBeDisabled()
 await page.locator('#safe-title').fill('Una idea para ARMY')
 await page.locator('#safe-body').fill('Compartamos ideas creativas para un concierto')
 await form.getByRole('checkbox').check()
 await form.getByRole('button',{name:'Enviar a revisión',exact:true}).click()
 await expect(page.locator('.safe-community [role=status]')).toContainText('Todavía no está publicada')
 await expect(page.locator('.safe-community article')).toHaveCount(1)
 await expect(page.locator('.safe-community article')).toContainText('pendiente')
 await expect(form.getByRole('checkbox')).not.toBeChecked()
})
test('conduct guide is available publicly in five languages',async({page})=>{
 await fixtureNetwork(page);await page.goto('/')
 for(const [code,label] of [['es','Manual de convivencia'],['en','Community conduct guide'],['ko','커뮤니티 행동 지침'],['pt','Manual de convivência'],['ja','コミュニティ行動ガイド']]) {
  await page.locator('#army-language').selectOption(code)
  const guide=page.locator('.conduct-guide')
  await expect(guide.locator('summary')).toHaveText(label)
  await guide.locator('summary').click()
  await expect(guide.locator('li')).toHaveCount(8)
  await guide.locator('summary').click()
 }
})
test('ages 14–17 can request their own account with independent choices and without parental fields',async({page})=>{
 const calls=await fixtureNetwork(page,{teenReady:true});await page.goto('/')
 await page.getByRole('button',{name:'¿No tenés cuenta? Registrate',exact:true}).click()
 await page.getByRole('combobox',{name:'Edad',exact:true}).selectOption('teen')
 await expect(page.getByRole('heading',{name:'De 14 a 17 años: cuenta propia',exact:true})).toBeVisible()
 await expect(page.getByRole('heading',{name:'Menores de 14 y autorización parental',exact:true})).toHaveCount(0)
 await expect(page.locator('#auth-email')).toBeVisible()
 const boxes=page.locator('.policy-choices input[type=checkbox]')
 await expect(boxes).toHaveCount(2)
 await expect(boxes.nth(0)).not.toBeChecked();await expect(boxes.nth(1)).not.toBeChecked()
 await page.locator('#auth-email').fill('fixture@example.invalid');await page.locator('#auth-password').fill('fixture-password-only')
 await boxes.nth(0).check();await boxes.nth(1).check()
 await page.getByRole('button',{name:'Registrarme',exact:true}).click()
 await expect.poll(()=>calls.filter(call=>call.path.endsWith('/auth/v1/signup')).length).toBe(1)
 const data=calls.find(call=>call.path.endsWith('/auth/v1/signup')).signup
 expect(data.age_band).toBe('teen');expect(data.terms_accepted).toBe(true)
 expect(data.privacy_acknowledged).toBe(true);expect(data.policy_version).toBe('2026-10-26.2')
 expect(Object.keys(data).some(key=>/parent|guardian|birth/i.test(key))).toBe(false)
})
test('independent teen signup stays closed if the server has not enabled that mode',async({page})=>{
 const calls=await fixtureNetwork(page,{teenReady:false});await page.goto('/')
 await page.getByRole('button',{name:'¿No tenés cuenta? Registrate',exact:true}).click()
 await page.getByRole('combobox',{name:'Edad',exact:true}).selectOption('teen')
 await page.locator('#auth-email').fill('fixture@example.invalid');await page.locator('#auth-password').fill('fixture-password-only')
 for(const box of await page.locator('.policy-choices input[type=checkbox]').all()) await box.check()
 await page.getByRole('button',{name:'Registrarme',exact:true}).click()
 await expect(page.getByRole('status')).toContainText('configuración del servidor')
 expect(calls.some(call=>call.path.endsWith('/auth/v1/signup'))).toBe(false)
})
test('illustrated home shortcuts navigate correctly and the mobile gallery stays within the viewport',async({page},info)=>{
 await fixtureNetwork(page);await page.goto('/');await signIn(page)
 await expect(page.getByRole('heading',{name:'¿Qué hacemos hoy?',exact:true})).toBeVisible()
 await expect(page.locator('.nav-tile svg')).toHaveCount(9)
 await expect(page.getByRole('button',{name:'🏠 Inicio',exact:true})).toHaveAttribute('aria-current','page')
 await page.screenshot({path:info.outputPath('home-desktop.png'),fullPage:true})
 await page.getByRole('button',{name:'Planificar un viaje',exact:true}).click()
 await expect(page.getByRole('combobox',{name:'✈️ Aeropuerto de origen',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'🏠 Inicio',exact:true}).click()
 await page.getByRole('button',{name:'Crear una propuesta',exact:true}).click()
 await expect(page.getByRole('heading',{name:'🎤 Proyectos ARMY',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'🏠 Inicio',exact:true}).click()
 for(const width of [390,320]) {
  await page.setViewportSize({width,height:844})
  await expect(page.getByRole('button',{name:'Planificar un viaje',exact:true})).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
  await page.screenshot({path:info.outputPath(`home-${width}.png`),fullPage:true})
  await page.getByRole('button',{name:'Abrir menú',exact:true}).click()
  await expect(page.getByRole('button',{name:'👤 Mi perfil',exact:true})).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
  await page.screenshot({path:info.outputPath(`home-menu-${width}.png`),fullPage:true})
  await page.getByRole('button',{name:'Cerrar menú',exact:true}).click()
 }
})
