# Pagos a organizadores: alcance confirmado

- Plataforma operada desde Argentina; organizadores de LATAM. Países concretos aún no definidos; habilitarlos por lista explícita después de aprobación del proveedor.
- Donaciones únicas y suscripciones pagas recurrentes para organizadores aprobados.
- Cobro solicitado en USD; liquidación al organizador en moneda local.
- Comisión bruta ARMY Travel: 20%. Parte del organizador: 80% antes de posibles impuestos y cargos externos a la política acordada.
- Los costos del proveedor los absorbe ARMY Travel dentro de su comisión. No descontarlos por segunda vez del organizador.

## Estado real

El 26 de octubre de 2026 el usuario confirmó que no tiene proveedor contratado y pidió preparar pagos reales con activación posterior. No se crearon checkouts, cuentas de cobro, suscripciones ni transferencias. No se modificó Supabase. Además del reparto, se preparó una capa interna de seguridad y simulación de estados sandbox con pruebas. No acredita pagos, no convierte moneda y no sustituye la confirmación del proveedor. Detalle y pruebas: `docs/PRUEBAS-Y-ACTIVACION.md`.

## Viabilidad por confirmar

dLocal for Platforms es un candidato, no una integración aprobada. Su documentación describe cuentas, splits y liquidaciones locales. La API distingue currency de currency_to_charge; expresar un precio en USD no garantiza cobrar al comprador en USD. Es necesario confirmar expresamente el campo y método habilitado para cada país, la aceptación de una plataforma argentina y del modelo de apoyo/donaciones a organizadores, recurrencia con split, costos, mínimos y plazos. No se asumió que la cobertura de cobros equivale a disponibilidad comercial para ARMY Travel.

Fuentes oficiales consultadas:
- https://docs.dlocal.com/docs/platforms-overview
- https://docs.dlocal.com/docs/split-payments-platforms
- https://docs.dlocal.com/reference/create-payment
- https://docs.dlocal.com/docs/argentina-payouts-v3
- https://www.dlocal.com/our-solution/dlocal-for-platforms/

## Regla de reparto

El bruto y los costos se reciben en centavos USD enteros. El 20% se redondea al centavo más cercano y la parte del organizador es la diferencia exacta, sin perder centavos. Si los costos superan el 20%, el resultado identifica un déficit de plataforma; no lo carga al organizador. Las tarifas mínimas del proveedor deben verificarse antes de admitir importes pequeños.

Ejemplo ilustrativo, no cotización del proveedor: bruto US$10, comisión bruta US$2, organizador US$8, costo hipotético US$0,65 y neto plataforma US$1,35. El equivalente local requiere una cotización real, identificada y aceptada. No inventar cotizaciones ni prometer desembolso inmediato.

## Flujo que deberá implementar el adaptador del proveedor

1. Administración aprueba organizador; el proveedor verifica identidad y destino bancario mediante su onboarding. Guardar únicamente identificadores y estados necesarios.
2. Servidor valida organizador habilitado, país admitido, plan/importe y calcula el reparto; nunca confiar en la comisión ni en una cuenta bancaria enviadas por el navegador.
3. Crear checkout alojado/tokenizado en sandbox. Mostrar moneda, importe y periodicidad al pagador. El feed puede mantener solo contadores; el checkout sí debe mostrar el precio.
4. Confirmar mediante webhook firmado y verificación de estado con el proveedor, con claves de idempotencia y eventos únicos. La URL de retorno no prueba un pago.
5. Actualizar contadores solo después de pago confirmado; distinguir suscripciones activas de pagos de renovación. Los registros manuales existentes no deben contarse otra vez.
6. Pedir al proveedor el split pactado y confirmar por separado la liquidación local. Distinguir pago aprobado, fondos disponibles, liquidación pendiente y liquidación completada.
7. Contabilizar reembolsos, disputas, renovaciones fallidas y cancelaciones; revertir comisiones y transferencias conforme al contrato, sin repetir desembolsos.

## Bloqueos para completar la integración

- Confirmación comercial del proveedor para el negocio y los países elegidos.
- Acceso sandbox y documentación habilitada del producto de marketplace/recurrencia, con tarifas y responsabilidad por conversión.
- Países iniciales concretos, precios/planes y frecuencia de suscripción.
- Sitio HTTPS y endpoint público de webhooks; todavía no hay sitio publicado.

No se habilitarán cobros o transferencias reales durante las pruebas. La activación de producción queda pendiente de una autorización específica y del alta con el proveedor.
