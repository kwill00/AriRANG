import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
const nativeRequire = createRequire(import.meta.url)
export function makeLoader(mocks = {}, parameters = {}) {
 const cache = new Map()
 function load(file) {
  const absolute = path.resolve(file)
  if (cache.has(absolute)) return cache.get(absolute).exports
  const module = { exports: {} }; cache.set(absolute, module)
  const input = fs.readFileSync(absolute,'utf8').replaceAll('import.meta.env','__testEnvironment')
  const code = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop:true } }).outputText
  const require = specifier => {
   if (Object.hasOwn(mocks,specifier)) return mocks[specifier]
   if (specifier.endsWith('.css')) return {}
   if (!specifier.startsWith('.')) return nativeRequire(specifier)
   const base = path.resolve(path.dirname(absolute),specifier)
   const target = [base,base+'.ts',base+'.tsx'].find(p=>fs.existsSync(p))
   if (!target) throw new Error('Module not found: '+specifier)
   return load(target)
  }
  new Function('require','exports','module','Deno','__testEnvironment',code)(require,module.exports,module,parameters.Deno,{ VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'test-public-placeholder' })
  return module.exports
 }
 return load
}
