import fs from 'node:fs'
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'))
const packages=Object.entries(lock.packages).filter(([location])=>location).map(([location,data])=>({package:location.replace(/^.*node_modules\//,''),version:data.version,license:data.license??'UNDECLARED',development:!!data.dev,location})).sort((a,b)=>a.package.localeCompare(b.package))
fs.writeFileSync('docs/dependency-licenses.json',JSON.stringify(packages,null,2)+'\n')
let notices='ARMY Travel — installed runtime dependency license notices\nGenerated from local package files. Preserve these notices on redistribution.\n'
for(const pkg of packages.filter(p=>!p.development)) {
 notices+=`\n${pkg.package} ${pkg.version} (${pkg.license})\n`
 const files=fs.readdirSync(pkg.location).filter(name=>/^licen[sc]e(?:\.|$)|^copyright/i.test(name))
 for(const name of files) if(fs.statSync(pkg.location+'/'+name).isFile()) notices+='\n'+fs.readFileSync(pkg.location+'/'+name,'utf8')+'\n'
 if(!files.length) notices+='License file not found at package root; consult the upstream package before redistribution.\n'
}
fs.writeFileSync('docs/runtime-license-notices.txt',notices)
console.log(`Inventoried ${packages.length} dependency license declarations; ${packages.filter(p=>p.license==='UNDECLARED').length} undeclared.`)
