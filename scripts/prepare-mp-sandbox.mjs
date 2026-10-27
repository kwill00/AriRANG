import fs from 'node:fs'
import path from 'node:path'
const reference=process.argv[process.argv.indexOf('--project-ref')+1]
if(!process.argv.includes('--project-ref')||!/^[a-z]{20}$/.test(reference??'')||reference==='buhgdsnxmmoqshvoyyth'){
 console.error('Indicá --project-ref con un NUEVO proyecto de pruebas. Producción está bloqueada.');process.exit(1)
}
const sources=['supabase/sandbox/00_base_app.sql',...fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort().map(f=>'supabase/migrations/'+f)]
const strip=sql=>sql.replace(/^\s*(begin|commit);\s*$/gim,'')
const output=path.resolve('artifacts/mp-sandbox.local',reference,'setup.sql')
fs.mkdirSync(path.dirname(output),{recursive:true})
const sql=`-- ONLY for the NEW empty test project ${reference}. Review in its SQL Editor.\n-- Never run against production. Generated locally; no remote request.\nbegin;\nset local lock_timeout='2s';\nset local statement_timeout='60s';\n`+
 sources.map(file=>`\n-- SOURCE: ${file}\n${strip(fs.readFileSync(file,'utf8'))}`).join('\n')+"\nnotify pgrst, 'reload schema';\ncommit;\n"
// Do not overwrite an existing artifact someone may be reviewing or editing.
try{fs.writeFileSync(output,sql,{flag:'wx'})}catch(error){if(error.code==='EEXIST'){console.error('El archivo ya existe; se conservó sin sobrescribir.');process.exit(1)}throw error}
console.log('SQL preparado localmente: '+output)
console.log('No se modificó ningún servidor. Revisalo y ejecutalo únicamente en el proyecto de pruebas indicado.')
