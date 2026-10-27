# Entorno aislado de pruebas preparado

27 de octubre de 2026. El operador autorizó subir el proyecto a GitHub, confirmó
plan Free con cupo y autorizó crear el servidor separado. No se modificó la
instancia de producción ni se publicó o amplió la visibilidad del sitio Netlify.

## GitHub

Repositorio: https://github.com/kwill00/AriRANG

Rama de trabajo: `feature/mercadopago-sandbox`.

- `8bd56a8`: aplicación y circuito aislado de pruebas.
- `0412560`: reconciliación de los historiales conservando el README inicial.

Se conservó `main` sin reemplazar ni forzar su historial. El README inicial también
está en `docs/README-INICIAL-GITHUB.md`. Netlify no tiene un repositorio conectado;
no se añadió una automatización de despliegue. Los iconos locales pendientes de
licencia, archivos de entorno y artefactos de pruebas no se subieron.

## Supabase nuevo

- Nombre: `army-travel-mp-test`.
- Referencia: `jdkjqsxcycpfowydciaq`.
- Organización Free confirmada por el operador: ARMY Travel.
- Región: `us-east-2`.
- Panel: https://supabase.com/dashboard/project/jdkjqsxcycpfowydciaq

Se instaló el bootstrap mínimo vacío y todas las migraciones actuales, incluida
`202610270001_mercadopago_pruebas.sql`, mediante una única transacción en este
proyecto. No se copiaron usuarios ni datos de producción. `public_ready=true`
permite únicamente preparar cuentas adultas de prueba; menores y eliminación
siguen deshabilitados. Las tablas del ledger son privadas y su RPC es solo de servicio.

Funciones desplegadas:

| Función | Estado | JWT |
| --- | --- | --- |
| `mercadopago-checkout-test` | ACTIVE, versión 1 | Obligatorio; verifica además usuario, rol admin y consentimiento adulto |
| `mercadopago-webhook-test` | ACTIVE, versión 1 | Sin JWT de Supabase; exige firma de Mercado Pago |
| `mercadopago-return-test` | ACTIVE, versión 1 | Retorno estático sin acreditar pagos |

Configuración de servidor guardada: referencia del proyecto de pruebas, origen
`http://127.0.0.1:5173` y URL del webhook. Auth tiene Site URL y redirect de confirmación
locales; la confirmación de correo se mantiene activada. Las demás opciones de Auth,
MFA, base y Storage no se reemplazaron por valores por defecto.

La contraseña inicial de base fue generada en memoria, no mostrada ni retenida en
archivos o Git. La configuración se administra por Management API con la sesión
de la CLI; si el operador necesita conexión directa a PostgreSQL, puede establecer
una contraseña propia desde el panel del proyecto nuevo.

`.env.sandbox.local` contiene solo la URL y clave pública del proyecto nuevo y está
ignorado por Git. `.env.local` de producción se conservó.

## Comprobaciones remotas realizadas

- Disponibilidad de registro adulto: true; adolescente: false.
- Acceso del navegador al ledger: rechazado.
- Checkout sin sesión: HTTP 401.
- Webhook no firmado sin secretos configurados: HTTP 503 (cerrado).
- Retorno HTTPS: HTTP 200; ignora parámetros de aprobación.

No se crearon usuarios, preferencias, pagos ni reembolsos durante esta preparación.
Las 71 pruebas de lógica/SQL y 22 E2E anteriores son locales con proveedor simulado;
no equivalen al ciclo completo de Mercado Pago en el nuevo servidor.

## Qué falta para comenzar el circuito con Mercado Pago

1. En Mercado Pago Developers, abrir la aplicación y obtener la credencial del
   **vendedor argentino de prueba**. El prefijo `APP_USR` por sí solo no determina
   si una cuenta es real o de prueba; el servidor lo valida con `/users/me`.
2. Configurar el evento **Pagos** en la URL de Webhooks de **pruebas**:
   `https://jdkjqsxcycpfowydciaq.supabase.co/functions/v1/mercadopago-webhook-test`.
   Guardar y obtener su firma secreta. No cambiar la URL de producción.
3. En https://supabase.com/dashboard/project/jdkjqsxcycpfowydciaq/functions/secrets
   guardar `MERCADOPAGO_ACCESS_TOKEN_TEST` y `MERCADOPAGO_WEBHOOK_SECRET_TEST`.
   No compartir los valores en chat, frontend, capturas ni repositorio.
4. Abrir la app local, registrarse por correo con una casilla que controle el
   operador, elegir franja adulta, aceptar los avisos y confirmar el correo.
   Usar correo hasta configurar Google en el sandbox. El retorno del login ya
   respeta el origen local; en producción conserva su dominio.
5. Identificar su UUID en Auth del proyecto nuevo y asignarle el rol de prueba
   desde SQL Editor (`update public.perfiles set rol='admin' where id='UUID';`).
   No se concedieron permisos administrativos automáticamente por un correo.
6. Entrar en Administración y probar ARS100 con un **comprador de prueba distinto**,
   comprobar el webhook, recuperar el historial y realizar/reintentar el reembolso
   total. Seguir la matriz de `MERCADOPAGO-SANDBOX.md`.

Inicio local reproducible:

```powershell
node --env-file=.env.sandbox.local scripts/dev-mp-sandbox.mjs --project-ref jdkjqsxcycpfowydciaq
```

Si ya está corriendo en 5173, conservar ese proceso. No detener servidores ajenos
ni cambiar el origen sin actualizar la configuración del sandbox.

El reparto efectivo, OAuth de organizadoras y cobros reales siguen pendientes.
No usar `db push` indiscriminado ni ejecutar el bootstrap sobre una base existente.

## Conexión del proveedor confirmada posteriormente

El operador guardó los dos secretos de Mercado Pago directamente en el proyecto
de pruebas. Se comprobó su presencia por nombre, sin consultar sus valores.
Se desplegó además `mercadopago-connection-test` con JWT obligatorio y se ejecutó
su consulta de solo lectura a `/users/me`, protegida por una clave de diagnóstico
aleatoria y efímera. Resultado real del proveedor desde Supabase: HTTP 200,
`ok=true`, `environment=sandbox`, `country=AR`, `livePaymentsEnabled=false`.

La clave efímera `MERCADOPAGO_DIAGNOSTIC_KEY` se retiró al finalizar; no se guardó
su valor en archivos ni Git. El diagnóstico queda cerrado sin esa clave. Los
secretos de token y webhook del operador se conservaron.

La aplicación local responde HTTP 200 y su módulo de Supabase referencia
`jdkjqsxcycpfowydciaq`, sin apuntar a producción. Se conservó el servidor que ya
ocupaba 5173, sin reemplazarlo. En la consulta de estado previa había cero cuentas,
cero administradores, cero consentimientos adultos y cero órdenes en el sandbox.
Se solicitó al operador registrarse y confirmar el correo; aún falta esa sesión
para crear el checkout y ejecutar compra/reembolso con el comprador de prueba.
No se han creado pagos ni reembolsos ni validado todavía la firma de una notificación
real del proveedor. Esta comprobación acredita la conexión de la cuenta vendedora,
no todo el circuito de pago. Producción y Netlify no se modificaron.
