// Política del servidor. No aceptar porcentajes ni destinatarios calculados por el cliente.
export function calcularRepartoUSD(brutoCentavos: number, costosProveedorCentavos: number) {
  if (!Number.isSafeInteger(brutoCentavos) || brutoCentavos <= 0) throw new RangeError('El pago debe expresarse en centavos USD positivos y enteros.')
  if (!Number.isSafeInteger(costosProveedorCentavos) || costosProveedorCentavos < 0) throw new RangeError('El costo del proveedor debe ser un entero no negativo en centavos USD.')
  const comisionBruta = Number((BigInt(brutoCentavos) * 2000n + 5000n) / 10000n)
  const organizador = brutoCentavos - comisionBruta
  const netoPlataforma = comisionBruta - costosProveedorCentavos
  return {
    moneda: 'USD' as const,
    brutoCentavos,
    comisionBps: 2000,
    comisionBrutaCentavos: comisionBruta,
    organizadorCentavos: organizador,
    costosProveedorCentavos,
    netoPlataformaCentavos: netoPlataforma,
    requiereCoberturaPlataforma: netoPlataforma < 0,
  }
}
