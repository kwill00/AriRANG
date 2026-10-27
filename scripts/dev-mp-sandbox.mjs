import { spawn } from 'node:child_process'
import { loadEnv } from 'vite'
const reference=process.argv[process.argv.indexOf('--project-ref')+1]
const env=loadEnv('development',process.cwd(),'VITE_')
const abort=message=>{console.error(message);process.exit(1)}
if(!process.argv.includes('--project-ref')||!/^[a-z]{20}$/.test(reference??'')||reference==='buhgdsnxmmoqshvoyyth')abort('Se requiere la referencia de un proyecto NUEVO de pruebas; producción está bloqueada.')
if(env.VITE_SUPABASE_URL!==`https://${reference}.supabase.co`)abort('El entorno no coincide con el proyecto de pruebas indicado. No se inició la app.')
if(Object.keys(env).some(key=>/TOKEN|SECRET|SERVICE_ROLE|PRIVATE|MERCADOPAGO/i.test(key)))abort('Hay una variable privada con prefijo VITE_. Retirala del entorno del navegador.')
const key=env.VITE_SUPABASE_PUBLISHABLE_KEY??''
if(key.startsWith('eyJ')){
 try{if(JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role!=='anon')abort('La clave del navegador debe ser pública, nunca service_role.')}catch{abort('Clave pública inválida.')}
}else if(!key.startsWith('sb_publishable_'))abort('Falta una clave pública válida para el proyecto de pruebas.')
const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],{stdio:'inherit',env:{...process.env,...env}})
child.on('error',()=>abort('No se pudo iniciar Vite.'))
child.on('exit',code=>process.exit(code??1))
