import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularRepartoUSD } from '../supabase/functions/_shared/reparto-pagos.ts'

test('US$10: organizador recibe US$7,50 y la plataforma absorbe el costo dentro de sus US$2,50', () => {
  const r = calcularRepartoUSD(1000, 65)
  assert.equal(r.organizadorCentavos, 750)
  assert.equal(r.comisionBrutaCentavos, 250)
  assert.equal(r.netoPlataformaCentavos, 185)
})
test('el costo superior al 25% no reduce la parte del organizador', () => {
  const r = calcularRepartoUSD(1000, 300)
  assert.equal(r.organizadorCentavos, 750)
  assert.equal(r.netoPlataformaCentavos, -50)
  assert.equal(r.requiereCoberturaPlataforma, true)
})
test('preserva cada centavo para importes pequeños y grandes', () => {
  for (const monto of [1, 2, 3, 4, 7, 99, 101, 999, 10001, Number.MAX_SAFE_INTEGER]) {
    const r = calcularRepartoUSD(monto, 1)
    assert.equal(r.organizadorCentavos + r.comisionBrutaCentavos, monto)
    assert.equal(r.organizadorCentavos + r.netoPlataformaCentavos + r.costosProveedorCentavos, monto)
    assert.equal(Number.isSafeInteger(r.organizadorCentavos), true)
  }
})
test('rechaza decimales, negativos, NaN e importes fuera de rango', () => {
  for (const monto of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => calcularRepartoUSD(monto, 0), RangeError)
  for (const costo of [-1, 0.5, NaN, Infinity]) assert.throws(() => calcularRepartoUSD(100, costo), RangeError)
})
