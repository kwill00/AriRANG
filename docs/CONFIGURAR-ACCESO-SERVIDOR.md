# Acceso y aceptación en el servidor

27 de octubre de 2026. La pantalla de bienvenida guarda las dos elecciones mediante
`privacy_accept_adult` o `privacy_accept_teen`, usando la sesión autenticada. Después
consulta `privacy_access_mode`: `adult` abre la aplicación, `minor_limited` abre el
espacio limitado y `restricted` conserva la pantalla. Una casilla no concede permisos.
No se guarda una autorización en localStorage ni se modifica `user_metadata` para
saltarse la revisión. Las políticas RLS continúan controlando cada operación.

Al recargar o volver a la ventana se consulta el permiso del servidor; también se
actualiza cada minuto. Una aceptación vigente no vuelve a solicitarse. Revocaciones,
cambios de versión o configuración pueden exigir revisar el acceso nuevamente.
Si falla la consulta se conserva el formulario y se puede volver a comprobar.

## Estado de producción

El operador confirmó que `buhgdsnxmmoqshvoyyth` es **producción**, autorizó acceso
administrativo y completó el login el 27 de octubre de 2026. La CLI 2.122.0 pudo
conectarse con `NODE_USE_SYSTEM_CA=1`; se mantuvo la validación TLS.

El diagnóstico inicial encontró ausentes las funciones y el esquema privado.
Se revisó el inventario real de tablas, funciones y triggers sin consultar filas
personales. Las tres migraciones siguientes se ensayaron contra el esquema real
en una transacción con rollback y después se instalaron en una sola transacción,
con límite de bloqueo de 2 segundos y de sentencia de 25 segundos:

- `202610250001_privacidad.sql`
- `202610260001_menores_conducta.sql`
- `202610260002_acceso_desde_14.sql`

Se recargó la caché de PostgREST. Un inventario previo de definiciones, permisos,
columnas, políticas y triggers se conserva en
`artifacts/production-access.local/schema-before.json`, ignorado por Git. No es un
backup de datos ni una recuperación automática. Los archivos SQL de ensayo y
despliegue también están en ese directorio local. No contienen claves.

**No repetir estas migraciones.** La instancia no tenía
`supabase_migrations.schema_migrations` al revisarla. Antes de adoptar `db push`,
reconciliar el historial con el esquema existente, incluidas las migraciones
sociales aplicadas previamente. No se fabricó un historial de aplicación.

La comprobación posterior confirmó funciones instaladas y respuestas públicas
válidas (ya no HTTP 404). La configuración queda en:

| Campo | Valor |
| --- | --- |
| `policy_version` | `2026-10-26.2` |
| `public_ready` | `false` |
| `minors_enabled` | `false` |
| `teen_self_access_enabled` | `false` |
| `deletion_reviewed` | `false` |

`supabase/verificar-acceso-produccion.sql` se ejecutó correctamente con rollback:
una identidad sintética sin cuenta conserva modo `restricted`, no obtiene acceso
adulto ni de menor y las aceptaciones se rechazan con el servicio cerrado.
Los roles `anon` y `authenticated` no obtienen acceso al esquema privado.
No se crearon usuarios ni se movió dinero. Las pruebas no verifican entrega de
correo, altas reales ni el ciclo completo del navegador contra producción.

El operador declaró como responsable a **Camilo Tobar (CEO)**, domicilio
**Trenca 13011, Bariloche, Argentina**, contacto `kwyktobar@gmail.com` para
privacidad/reclamos y alcance previsto **toda Latinoamérica**. Confirmó que
**él revisará las publicaciones adolescentes** antes de su publicación.
Son datos declarados; no se afirma una verificación de identidad ni de capacidad
operativa. No se otorgó ningún rol administrativo a una cuenta por su correo.
Siguen pendientes retención, backups, transferencias internacionales y revisión
de las políticas y requisitos por país. El alcance previsto no equivale a una
habilitación en todas las jurisdicciones. No se habilitaron
las banderas públicas. El rediseño de interfaz está publicado en Netlify;
el despliegue del frontend no modifica estas banderas del servidor.

Para repetir las dos consultas públicas sin imprimir claves:

```powershell
node --use-system-ca --env-file=.env.local scripts/check-access-server.mjs --project-ref buhgdsnxmmoqshvoyyth
```

El script rechaza destinos distintos del proyecto indicado, no sigue redirecciones
y no crea cuentas ni modifica datos.

1. Identificar proyecto y entorno antes de tocar la base. Probar primero en una copia
   de pruebas con el esquema real sanitizado; no ejecutar un `db push` indiscriminado.
2. Ejecutar `supabase/diagnostico-acceso.sql`. Si faltan funciones en otro entorno, revisar y aplicar
   las migraciones pendientes en orden, desde las dependencias sociales hasta
   `202610260002_acceso_desde_14.sql`. No repetir migraciones ya aplicadas.
3. Revisar la configuración privada con la consulta comentada del diagnóstico.
   `public_ready` controla el acceso adulto. El acceso adolescente requiere además
   `minors_enabled` y `teen_self_access_enabled`. Todos empiezan deshabilitados.
   No habilitarlos automáticamente: completar responsable/contacto, países,
   políticas y capacidad de moderación según `ACCESO-DESDE-14.md`.
4. Una vez revisados los requisitos, configurar las banderas desde SQL Editor o un
   proceso administrativo del servidor, nunca desde el navegador del usuario.
   No alterar `deletion_reviewed` como parte de habilitar el acceso.
5. Comprobar con cuentas sintéticas: adulto, adolescente, menor de 14, sin aceptar,
   consentimiento antiguo y revocado. Aceptar, recargar y volver a iniciar sesión:
   solo las cuentas autorizadas deben dejar de ver la bienvenida. Una aceptación
   rechazada o un error de red no deben abrir el acceso.

Los menores de 14 mantienen el flujo parental pendiente de integración; adolescentes
autorizados continúan sin pagos, mensajes privados ni publicación sin moderación.
Los correos de confirmación y sus URLs dependen de Auth en Supabase y del dominio
de Netlify. El despliegue de funciones de eliminación/baja es independiente de estas
RPC y sigue necesitando su configuración propia. Ningún pago real se activa aquí.

## Validación local

58 pruebas de lógica/SQL y 22 pruebas E2E de Chrome aprobadas. Incluyen checkout
administrativo de prueba con red simulada, aceptación
adulta y adolescente, desaparición de la bienvenida y persistencia al recargar,
rechazo con conservación de elecciones, recuperación de una consulta fallida y
ancho de 320 px. Las pruebas de navegador simulan el servidor; no equivalen a un
alta real. Se revisó la captura móvil. Lint y build correctos; continúa el aviso
del tamaño del bundle. El diagnóstico SQL también se ejecuta en la base local
descartable, sin habilitar banderas.

## Publicación de interfaz

Destino autorizado: sitio Netlify `quiet-kelpie-28a2b2`, `https://armytravellatam.com`.
Después de completar el login, se publicó mediante CLI el deploy de producción
`6ae0cdd6bfbffcb441353a5c`. Se verificaron por HTTPS los bytes del bundle
`index-DrDpq4g1.js`, manifiesto, service worker y avisos de licencia, además de
CSP, Referrer-Policy y X-Content-Type-Options.

El build ahora incluye solo los cuatro recursos públicos revisados: icono SVG,
manifiesto, pantalla offline y service worker. Los originales de licencia pendiente
se conservan en la carpeta y se excluyen del artefacto. El corazón de comunidad
se reemplazó por geometría original. Se verificó el contenido de `dist` y se
eliminó una entrada duplicada del manifiesto. También se distribuyen los avisos
de licencia de runtime. `.netlify/` queda fuera de Git.

El operador confirmó ahora **Mercado Pago** como proveedor. Se conservaron los
cambios existentes de checkout de prueba y acceso con Google. Las funciones
`mercadopago-connection-test` y `mercadopago-checkout-test` están ACTIVE en Supabase,
con verificación JWT activada. El checkout administrativo usa ARS100 ficticios,
solo para cuentas administradoras adultas y vendedor de prueba argentino; no
ejecuta el reparto. No se creó ni se pagó una preferencia durante esta publicación.
Siguen pendientes la prueba integral con comprador de prueba, OAuth de organizadoras,
órdenes persistentes, webhooks, reembolsos y validación de comisiones antes de cobros
reales. Las dos funciones públicas de disponibilidad de registro siguen en false.
