import {test,expect} from '@playwright/test'
const id='00000000-0000-4000-8000-000000000001'
const user={id,aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',user_metadata:{},app_metadata:{provider:'email'},created_at:'2026-10-25T00:00:00Z'}
const jwt=[{alg:'HS256',typ:'JWT'},{sub:id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'fixture'].map((v,i)=>i===2?v:Buffer.from(JSON.stringify(v)).toString('base64url')).join('.')
async function fixture(page,admin=true){
 const requests=[]
 const order={orderId:'00000000-0000-4000-8000-000000000022',status:'pending',amount:100,currency:'ARS',refundedAmount:0,refundRequested:false,environment:'sandbox',splitApplied:false,livePaymentsEnabled:false}
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url()),path=url.pathname
  if(url.origin==='http://127.0.0.1:5187')return route.continue()
  let body=[]
  if(path.includes('/auth/v1/token'))body={access_token:jwt,token_type:'bearer',expires_in:3600,refresh_token:'fixture-refresh',user}
  else if(path.endsWith('/auth/v1/user'))body=user
  else if(path.endsWith('/rpc/privacy_access_mode'))body='adult'
  else if(path.endsWith('/rpc/es_admin'))body=admin
  else if(path.endsWith('/functions/v1/mercadopago-checkout-test')){
   const request=route.request().postDataJSON();requests.push(request)
   if(request.action==='verify')order.status='approved'
   if(request.action==='refund'){order.status='refunded';order.refundedAmount=100;order.refundRequested=true}
   body=request.action==='list'?{orders:[order]}:request.action==='create'?{...order,checkoutUrl:'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=fixture'}:{...order,verified:request.action==='verify'}
  }
  else if(path.endsWith('/rpc/community_review_queue')||path.endsWith('/rpc/comunidad_listar_reportes'))body=[]
  else if(path.includes('/rpc/'))body=false
  else if(!path.startsWith('/rest/v1/'))return route.abort('blockedbyclient')
  return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)})
 })
 return requests
}
async function signIn(page){
 await page.getByLabel('Correo electrónico',{exact:true}).fill('fixture@example.invalid')
 await page.getByLabel('Contraseña',{exact:true}).fill('fixture-password')
 await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click()
}
test('admin checkout declares no split, creates fixed test preference and verifies return through server',async({page})=>{
 const requests=await fixture(page)
 await page.goto('/?checkout_test=return');await signIn(page)
 await expect(page.getByRole('heading',{name:'Checkout de prueba · Mercado Pago'})).toBeVisible()
 await expect(page.getByText('todavía no aplica el split',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Preparar checkout de prueba · ARS 100',exact:true}).click()
 await expect(page.getByRole('link',{name:'Continuar en Mercado Pago · Solo prueba',exact:true})).toHaveAttribute('href','https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=fixture')
 expect(requests[0].action).toBe('create');expect(requests[0].requestId).toMatch(/^[0-9a-f-]{36}$/)
 expect(Object.keys(requests[0]).sort()).toEqual(['action','requestId'])
 await page.goto('/?checkout_test=return&payment_id=123&status=approved')
 await expect(page.getByText('Pago ficticio verificado con Mercado Pago:',{exact:false})).toHaveCount(0)
 await page.getByRole('button',{name:'Verificar resultado con Mercado Pago',exact:true}).click()
 await expect(page.getByRole('status').filter({hasText:'Estado de la orden de prueba: aprobado.'})).toBeVisible()
 expect(requests[1]).toEqual({action:'verify',orderId:'00000000-0000-4000-8000-000000000022',paymentId:'123'})
 const refund=page.getByRole('button',{name:'Reembolsar prueba · ARS 100',exact:true})
 await expect(refund).toBeDisabled()
 await page.getByLabel('Escribí REEMBOLSAR PRUEBA para confirmar',{exact:true}).fill('REEMBOLSAR PRUEBA')
 await refund.click()
 await expect(page.getByRole('status').filter({hasText:'Estado de la orden de prueba: reembolsado.'})).toBeVisible()
 expect(requests[2]).toEqual({action:'refund',orderId:'00000000-0000-4000-8000-000000000022',confirmation:'REEMBOLSAR PRUEBA'})
 await page.reload()
 await page.getByRole('button',{name:'Actualizar estado guardado',exact:true}).click()
 await expect(page.getByText('Estado guardado: reembolsado.',{exact:false})).toBeVisible()
 await page.setViewportSize({width:360,height:900})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:'test-results/checkout-admin-mobile.png',fullPage:true})
})
test('non-admin cannot see checkout even when opening the return URL',async({page})=>{
 const requests=await fixture(page,false)
 await page.goto('/?checkout_test=return');await signIn(page)
 await expect(page.getByRole('button',{name:'Preparar checkout de prueba · ARS 100',exact:true})).toHaveCount(0)
 expect(requests).toEqual([])
})

test('administration sections support keyboard, preserve review controls and stay compact on mobile',async({page})=>{
 const checkout=await fixture(page)
 const mutations=[]
 await page.route('**/rpc/community_review_queue',route=>route.fulfill({contentType:'application/json',body:JSON.stringify([{id:'review-fixture',titulo:'Propuesta para el concierto',contenido:'Una propuesta de comunidad para revisar antes de publicar.',estado:'pendiente',senales:[]}])}))
 await page.route('**/rpc/community_review_safe',async route=>{mutations.push(route.request().postDataJSON());await route.fulfill({contentType:'application/json',body:'null'})})
 await page.route('**/solicitudes_organizadora?**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify([{id:'application-fixture',nombre_organizacion:'Organización de prueba',pais:'Argentina',descripcion:'Solicitud ficticia para comprobar la interfaz.',redes_sociales:null,estado:'pendiente',creado_en:'2026-10-27T12:00:00Z'}])}))
 await page.goto('/');await signIn(page)
 await page.getByRole('button',{name:'🛡️ Administración',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Administración',exact:true})).toBeVisible()
 const review=page.getByRole('tab',{name:'Revisión previa',exact:true})
 await expect(review).toHaveAttribute('aria-selected','true')
 await expect(page.getByRole('button',{name:'Aprobar publicación',exact:true})).toBeDisabled()
 await expect(page.getByRole('button',{name:'Rechazar o retirar',exact:true})).toBeDisabled()
 await page.screenshot({path:test.info().outputPath('admin-desktop.png'),fullPage:true})
 await review.focus();await page.keyboard.press('ArrowRight')
 await expect(page.getByRole('tab',{name:'Reportes',exact:true})).toBeFocused()
 await expect(page.getByRole('heading',{name:'Reportes de la comunidad',exact:true})).toBeVisible()
 await page.keyboard.press('End')
 await expect(page.getByRole('heading',{name:'Checkout de prueba · Mercado Pago',exact:true})).toBeVisible()
 await expect(page.locator('.admin-external')).not.toHaveAttribute('open','')
 await page.getByRole('tab',{name:'Solicitudes',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Organización de prueba',exact:true})).toBeVisible()
 page.once('dialog',dialog=>dialog.dismiss())
 await page.getByRole('button',{name:'Aprobar solicitud',exact:true}).click()
 expect(checkout).toEqual([]);expect(mutations).toEqual([])
 await review.click()
 await page.getByLabel('Motivo de revisión',{exact:true}).fill('Revisar el contexto antes de publicar.')
 await expect(page.getByRole('button',{name:'Aprobar publicación',exact:true})).toBeEnabled()
 await page.getByRole('button',{name:'Rechazar o retirar',exact:true}).click()
 expect(mutations).toEqual([{p_id:'review-fixture',p_aprobar:false,p_nota:'Revisar el contexto antes de publicar.'}])
 await page.setViewportSize({width:320,height:900})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.evaluate(()=>window.scrollTo(0,0))
 await page.screenshot({path:test.info().outputPath('admin-mobile.png'),fullPage:true})
})

test('notification chip separates unread count and keeps its details inside the expanded panel',async({page})=>{
 await fixture(page)
 await page.route('**/social_notificaciones?**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify([{id:'notice-1',leida:false,creado_en:'2026-10-27T12:00:00Z'},{id:'notice-2',leida:false,creado_en:'2026-10-27T12:00:00Z'}])}))
 await page.goto('/');await signIn(page)
 const button=page.getByRole('button',{name:'Avisos sin leer: 2 (últimos 20)',exact:true})
 await expect(button).toBeVisible();await expect(button).toHaveAttribute('aria-expanded','false')
 expect(await button.innerText()).not.toContain('últimos 20')
 const footer=await page.locator('.world-footer').boundingBox();expect(footer.height).toBeLessThan(100)
 await button.click();await expect(page.getByText('Se muestran los últimos 20 avisos.',{exact:true})).toBeVisible()
 await button.click();await expect(page.locator('#social-notices-panel')).toHaveCount(0)
})
