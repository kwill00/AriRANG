# Mercado Pago: conexión verificada el 27 de octubre de 2026

Actualización local posterior: [preparación de checkout persistente, webhook y
reembolsos para un proyecto aislado](MERCADOPAGO-SANDBOX.md). No está desplegada;
los apartados siguientes describen el avance remoto anterior.

Argentina; aplicación Mercado Pago 3255709617056249; Supabase buhgdsnxmmoqshvoyyth.
Secretos del servidor: MERCADOPAGO_ACCESS_TOKEN_TEST y MERCADOPAGO_DIAGNOSTIC_KEY. Nunca copiar sus valores al frontend, código o documentación.
Reparto acordado: organizadora 75%, plataforma 25%, costos del proveedor a cargo de plataforma.

## Verificado

La función mercadopago-connection-test está desplegada. Conserva Verify JWT activado y requiere además x-diagnostic-key con una clave exclusiva de diagnóstico. No usa ni revela service_role.
Consulta GET https://api.mercadopago.com/users/me y exige site_id MLA y etiqueta test_user. Solo devuelve estado y política configurada, sin datos de cuenta ni secretos. Se confirmó respuesta ok:true, environment:sandbox, country:AR, currency:ARS contra Mercado Pago desde Supabase.
Checkout Pro puede usar Access Tokens APP_USR para usuarios de prueba; el prefijo no acredita el entorno. Se comprueba la cuenta por API antes de confirmar la conexión.

## Pendiente

Ya existe un checkout de prueba administrativo de ARS100; ver CHECKOUT-PRUEBA-PUBLICACION.md. Todavía no hay OAuth de organizadoras ni webhooks de pagos implementados. No se crearon pagos ni se habilitaron cobros reales. Los porcentajes en la respuesta de diagnóstico expresan la política de ARMY Travel, no un split ejecutado o validado por Mercado Pago.

Mercado Pago descuenta su tarifa al vendedor antes de la comisión del marketplace. Un marketplace_fee fijo de 25% no garantiza que la organizadora reciba 75%. Resolver y comprobar la asignación de costos antes de habilitar checkout. No asumir tasas del proveedor ni prometer un neto no verificado.

La versión desplegada combina handler.ts e index.ts en un solo archivo; el código local conserva el handler separado para pruebas.

Referencias:
- https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/test-accounts
- https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace
