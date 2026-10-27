# Validar Mercado Pago sin tocar producción

Trabajo local del 27 de octubre de 2026. **No se aplicaron estas migraciones ni se
desplegaron estas funciones en ningún servidor. No se publicó la web.**
La instancia `buhgdsnxmmoqshvoyyth` está bloqueada explícitamente por el nuevo
código de pagos y por los scripts de preparación/arranque.

## Qué está preparado

- Checkout administrativo de ARS 100, vendedor argentino `MLA` marcado `test_user`
  por la API. El prefijo del token no acredita que una cuenta sea de prueba.
- Órdenes privadas en PostgreSQL, identidad del usuario comprobada por Auth y
  consentimiento adulto/rol admin comprobados por RPC. El navegador no elige
  importe, moneda, vendedor ni comisión. Los menores no pueden iniciar el circuito.
- Persistencia e historial propio: no se depende del token temporal de la versión
  anterior ni de parámetros de retorno. El navegador conserva solo identificadores.
- Webhook con HMAC-SHA256, `data.id` de la URL, `x-request-id` y timestamp; comparación
  criptográfica, ventana de cinco minutos (futuro máximo un minuto), persistencia
  idempotente y consulta de `/v1/payments/{id}`. No se usa un estado del cuerpo como
  prueba. Una consulta/persistencia fallida devuelve error para permitir reintento.
- Estados pendiente, en proceso, aprobado, rechazado, cancelado, reembolso parcial,
  reembolsado y contracargo. Se comprueban importe, moneda, referencia, receptor,
  `live_mode=false`, identidad del pago y fecha del proveedor. Un evento atrasado no
  deshace una aprobación; un pago reembolsado no vuelve a aprobado.
- Reembolso **total** de ARS 100 con confirmación escrita, preflight contra Mercado
  Pago y clave de idempotencia conservada en base incluso si se pierde la respuesta.
  La respuesta del POST no acredita por sí sola que la orden esté reembolsada: se
  vuelve a consultar el pago. Los reembolsos parciales recibidos se registran, pero
  esta interfaz no emite reembolsos parciales ni reembolsa un saldo restante.

El reparto vigente 75% organizadora / 25% plataforma se conserva en su calculadora
y pruebas. **Este checkout no ejecuta split ni acredita aportes, suscripciones o
liquidaciones.** No convierte el precio ARS a USD ni presume una tarifa del proveedor.
OAuth de organizadoras, split efectivo y comisiones netas siguen pendientes.

`mercadopago-checkout-test/index.ts` usa `lifecycle.ts`. El antiguo `handler.ts` se
conserva para regresión/comparación con la versión remota anterior y no es una ruta
de fallback. La interfaz y la función nuevas deben usarse juntas en el proyecto de
pruebas. No publicar este frontend apuntando a la función v1 de producción.

## 1. Crear el proyecto separado

En [Supabase Dashboard](https://supabase.com/dashboard) elegí **New project**, con
nombre sugerido `army-travel-mp-test`. Elegí la organización y región, guardá la
contraseña de base en tu gestor y revisá el plan/cuota antes de crear el proyecto.
No restauremos datos ni usuarios de producción. Compartí únicamente la URL del
panel o su referencia cuando esté listo, nunca contraseñas o claves privadas.

Tomá la referencia de `https://supabase.com/dashboard/project/REFERENCIA`.
En una terminal de esta carpeta:

```powershell
node scripts/prepare-mp-sandbox.mjs --project-ref REFERENCIA_NUEVA
```

Esto solo genera `artifacts/mp-sandbox.local/REFERENCIA_NUEVA/setup.sql`, ignorado por
Git. No conecta con servidores ni sobrescribe un archivo existente. Abrilo, revisalo
y ejecutalo una vez en **SQL Editor del proyecto nuevo**, comprobando el nombre del
proyecto antes de ejecutar. Contiene una base mínima vacía para probar esta app y
las migraciones del repositorio en orden. No es una copia fiel de toda la operación
de producción. No crea ni reemplaza los esquemas administrados `auth` y `storage`.
El bootstrap se niega a ejecutarse si detecta las tablas de una aplicación existente.
No uses `tests/helpers/supabase-fixture.sql` en un Supabase real.

Solo en este proyecto descartable, habilitá el alta adulta para tu operador de prueba:

```sql
update privacy_private.configuration set public_ready=true where singleton;
-- Mantener minors_enabled=false, teen_self_access_enabled=false y deletion_reviewed=false.
```

En Auth → URL Configuration, configurá la URL local `http://127.0.0.1:5173` para
confirmación/inicio de sesión. Usá registro por correo, con una casilla dedicada
que controles una vez arrancada la app del paso 2, elegí la franja adulta y completá los consentimientos. No uses
Google: el flujo existente apunta al dominio de producción. Tras confirmar el
correo e ingresar, obtené el UUID de ese usuario en Auth y, solo en el SQL Editor
de pruebas, asignale el rol de prueba:

```sql
update public.perfiles set rol='admin' where id='UUID_DE_TU_OPERADOR_DE_PRUEBA';
```

No asignes el rol por un correo enviado desde el navegador ni copies usuarios reales.

## 2. Conectar solo la aplicación local

Creá `.env.sandbox.local` (ignorado por Git), con **solo** estas variables públicas:

```dotenv
VITE_SUPABASE_URL=https://REFERENCIA_NUEVA.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=CLAVE_PUBLICA_DEL_PROYECTO_NUEVO
```

No reemplaces `.env.local`, que corresponde al entorno existente. Para iniciar:

```powershell
node --env-file=.env.sandbox.local scripts/dev-mp-sandbox.mjs --project-ref REFERENCIA_NUEVA
```

El script fuerza la coincidencia entre URL y proyecto, rechaza la referencia de
producción y variables privadas `VITE_*`, y escucha solo en `127.0.0.1:5173`. Las
variables públicas de este archivo prevalecen sobre `.env.local`. Una clave
`service_role` o `sb_secret_` nunca debe entrar al navegador. No publiques este sitio.

## 3. Preparar las cuentas y secretos de prueba

En Mercado Pago Developers, usá cuentas de **vendedor y comprador de prueba de
Argentina distintas**. Usá únicamente tarjetas y saldo de prueba. La función
comprobará `test_user` mediante `/users/me` antes de crear preferencias o reembolsos.

En **Edge Functions → Secrets del proyecto Supabase NUEVO**, configurá:

| Nombre | Valor / procedencia |
| --- | --- |
| `MERCADOPAGO_TEST_PROJECT_REF` | Referencia del proyecto nuevo |
| `MERCADOPAGO_TEST_ORIGIN` | `http://127.0.0.1:5173` |
| `MERCADOPAGO_ACCESS_TOKEN_TEST` | Credencial privada del vendedor de prueba |
| `MERCADOPAGO_WEBHOOK_SECRET_TEST` | Firma secreta de Webhooks de la aplicación de prueba |
| `MERCADOPAGO_WEBHOOK_TEST_URL` | `https://REFERENCIA_NUEVA.supabase.co/functions/v1/mercadopago-webhook-test` |

Supabase inyecta `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`
en el servidor. No se copian a componentes, Vite ni documentación. Los archivos
`supabase/functions/.env*` están ignorados; preferí el panel de secretos para la
prueba hospedada. No compartas capturas con claves ni pegues credenciales en el chat.

## 4. Desplegar SOLO en el proyecto nuevo, cuando lo hayamos conectado

Estos comandos son pasos futuros: no se ejecutaron en esta entrega. Sustituí la
referencia por la nueva; **nunca** por `buhgdsnxmmoqshvoyyth`. El proyecto no necesita
vincularse con `supabase link`: cada comando indica su destino explícitamente.

```powershell
npx supabase functions deploy mercadopago-checkout-test --project-ref REFERENCIA_NUEVA
npx supabase functions deploy mercadopago-webhook-test --project-ref REFERENCIA_NUEVA --no-verify-jwt
npx supabase functions deploy mercadopago-return-test --project-ref REFERENCIA_NUEVA --no-verify-jwt
```

Solo webhook y retorno estático no exigen JWT: Mercado Pago no envía una sesión de
Supabase. El webhook exige su firma HMAC y valida el pago con el proveedor. El
checkout siempre exige sesión, consentimiento adulto y administración. No usar
`--no-verify-jwt` en checkout. Si la CLI necesita los certificados de Windows:
`$env:NODE_USE_SYSTEM_CA='1'`; no desactivar TLS.

En Mercado Pago → Tu integración → Webhooks configurá la **URL de pruebas**, tópico
`payment`, con la URL del webhook del proyecto nuevo. No cambies la URL de producción.
La función de retorno es un aviso HTTPS estático que no lee los parámetros ni marca
pagos como aprobados. No vuelve automáticamente al sitio público; regresás a la
pestaña local. Esto evita usar `localhost` como `back_urls`, que Mercado Pago no admite.

## 5. Validar el circuito real de pruebas

1. Ingresá a la app local con el operador adulto de prueba y abrí Administración.
2. Prepará el checkout ARS 100. Un doble clic/reintento debe recuperar la misma
   preferencia para el mismo identificador de solicitud.
3. Abrí el checkout y comprá con el comprador y tarjeta de prueba argentinos.
4. Volvé desde el aviso HTTPS a la pestaña local y pulsá **Actualizar estado guardado**.
   El webhook debe haber confirmado el estado consultando a Mercado Pago. Si no
   llegó, ingresá el identificador de pago de prueba y pulsá **Verificar resultado**.
5. Cerrá/reabrí la pestaña, ingresá de nuevo y elegí **Recuperar mis pruebas**. No
   debería perderse el historial ni depender de un token de la sesión anterior.
6. En un pago aprobado sin reembolso parcial, escribí **REEMBOLSAR PRUEBA** y pedí
   el reembolso total. Confirmá también el resultado en Mercado Pago de prueba.
7. Reintentá después de un timeout: debe conservarse la misma clave de reembolso
   del servidor. Nunca volver a pulsar con otra orden para duplicar un reembolso.
8. Probá aprobado, pendiente/rechazado, notificación repetida y manipulada, pago
   ajeno, importe distinto y cuenta no administradora. Guardá evidencia sanitizada.

Si la creación de preferencia quedó incierta, no se repite automáticamente: la orden
queda `creating` para conciliación con el proveedor. No borres la orden para forzar
otro intento. Webhooks antiguos fuera de la ventana requieren reconciliación manual
con **Verificar resultado**; no se aceptan firmas sin límite de tiempo. Un segundo
pago exitoso de otra tentativa sobre una orden ya pagada requiere conciliación; no
se acredita dos veces ni se reembolsa automáticamente sin revisar.

## Validación hecha y límites

| Comprobación | Resultado local |
| --- | --- |
| `npm test` | 71 aprobadas |
| `npm run test:e2e` | 22 aprobadas en Chrome aislado |
| `npm run lint` | Correcto |
| `npm run check:payments` | Tipos de handlers y adaptadores correctos |
| `npm run build` | Correcto; continúa el aviso de bundle superior a 500 kB |

También se comprobó que el arranque rechaza la referencia de producción y que
el SQL generado y los archivos de secretos locales quedan ignorados por Git.

Pruebas locales con identidades/cuentas sintéticas y red del proveedor simulada;
PostgreSQL real en PGlite para persistencia y permisos. También se probó el esquema
vacío de sandbox más todas las migraciones. No son compras ni reembolsos efectuados
en Mercado Pago. Falta crear/conectar el proyecto aislado, configurar sus secretos,
desplegar allí y ejecutar el circuito anterior con cuentas de prueba reales.
No se consultaron secretos ni se modificó Supabase de producción o Netlify.

Referencias oficiales:

- [Entornos separados en Supabase](https://supabase.com/docs/guides/deployment/managing-environments).
- [Secretos de Edge Functions](https://supabase.com/docs/guides/functions/secrets).
- [Firma de Webhooks de Mercado Pago](https://www.mercadopago.com.ar/developers/es/docs/split-payments/additional-content/your-integrations/notifications/webhooks?scope=prod).
- [Reembolsos e idempotencia](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-api-payments/create-refund/post).
- [Cuentas de prueba](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/test-accounts).
- [URLs de retorno](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-preferences/configure-back-urls).
