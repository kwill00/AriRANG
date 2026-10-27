# Acceso de menores y preparación del commit

**Modelo actualizado:** la ruta 14–17 ahora admite cuenta propia sin verificación parental. Los apartados de alta parental de este documento quedan referidos a menores de 14 y casos históricos. Ver [Cuenta propia desde los 14](ACCESO-DESDE-14.md), que prevalece sobre el alcance inicial descrito aquí.

26 de octubre de 2026. El usuario indicó que estima un público mayoritariamente menor y autorizó preparar los archivos relacionados en staging, sin crear commit.

## Comportamiento incorporado

- Desde login y desde el aviso por edad se puede entrar como visitante al planificador. No se pide edad, identidad ni datos parentales para este modo. Los importes permanecen solo en memoria y desaparecen al salir o recargar; cambiar el idioma no los envía a un traductor.
- El manual de convivencia está disponible públicamente y traducido en los cinco idiomas. Las reglas incluyen privacidad, respeto, contenido sexual, violencia, dinero, enlaces, spam, suplantación y pedidos de secretos.
- Las cuentas de menores tienen una ruta propia, `minor_limited`, decidida por el servidor. No se cargan los componentes de perfiles, directorio, comentarios, viajes compartidos, push ni pagos del área adulta.
- La autorización parental tiene versión, permisos separados y vencimiento. `private_planner` no incluye `moderated_posts`. La retirada, la caducidad, una nueva versión de política o deshabilitar menores en servidor impiden continuar.
- Las propuestas de ese espacio siempre quedan pendientes. No se insertan en el feed adulto existente. Solo un administrador adulto autorizado y diferente del autor puede aprobar o retirar una propuesta, con motivo e historial.
- El servidor señala vocabulario de una lista inicial, rechaza patrones evidentes de enlaces/contactos y limita los envíos a cinco por día por cuenta. Esto no garantiza detectar todos los problemas: incluso sin señales es obligatoria la revisión humana.
- El feed limitado devuelve solamente título, texto, ID de publicación y fecha. No devuelve autor, correo, avatar ni perfil. El texto libre debe revisarse manualmente para evitar datos identificables.
- Los reportes usan categorías predefinidas, no piden contacto y no muestran la identidad de quien reportó. Administración puede consultar el resumen y retirar la publicación.

## Base de datos y alta verificada

La nueva migración `202610260001_menores_conducta.sql` está preparada y ensayada en PostgreSQL local, no aplicada a Supabase. La versión de política pasa a `2026-10-26`: exige renovar aceptaciones de versiones anteriores; los campos originales no se sobrescriben para fingir consentimiento nuevo.

`minors_enabled` comienza en `false`. No debe activarse con evidencia inventada ni solo por tener el manual publicado. Falta completar responsable, países, edades, proveedor o procedimiento de verificación parental, avisos y capacidad humana de moderación.

Para una cuenta existente, el servicio confiable puede entregar un evento firmado con `policy_version`, `scopes` y `expires_at`. El adaptador llama `privacy_parental_authorize`. Los eventos anteriores sin esos campos no habilitan el espacio limitado. Se mantienen firma HMAC, ventana temporal, ID único y bloqueo de reapertura de un caso revocado.

Para una cuenta nueva, después de verificar al adulto y su responsabilidad real, el backend puede emitir una admisión mediante `privacy_issue_minor_admission`. Su ticket dura 15 minutos, es de un solo uso y se coloca con Auth Admin en `app_metadata.army_minor_admission`, nunca mediante un formulario público o `user_metadata`. Los triggers consumen el ticket y crean el estado parental limitado sin declarar falsamente que la persona es adulta. La interfaz de onboarding del verificador sigue pendiente; no hay un botón que simule esa verificación.

Los tickets vencidos deben eliminarse periódicamente con la RPC de servicio `privacy_purge_minor_admissions`; su evidencia de consentimiento permanece en el registro parental asociado cuando se completó un alta. La tarea de limpieza no se programó en la base conectada. Los tickets consumidos y las propuestas/reportes asociados se eliminan en cascada al borrar la cuenta; revisar el esquema real antes de habilitar la eliminación en producción.

## Operación pendiente

Es necesario desplegar y probar la nueva migración, el receptor parental actualizado y las políticas contra staging con el esquema real. Definir quién modera, cómo revisa, cómo escala incidencias y qué avisos/derechos tienen las familias. No se inventó identidad del responsable, contacto, garantías legales ni prueba de parentesco. No se habilitaron cobros ni se realizaron altas infantiles reales.

Esta entrega permite **visitar y usar el planificador local ahora**. El ingreso con cuenta y propuestas moderadas está implementado y probado con autorizaciones sintéticas; depende de la verificación y configuración externas para utilizarse con personas reales.

## Pruebas

Resultado final: **42 pruebas de lógica/SQL y 13 pruebas E2E aprobadas**, más lint y build correctos. Las nueve migraciones se ejecutaron en el fixture local; no en la instancia conectada.

`npm.cmd test` cubre SQL, admisiones de un solo uso, permisos limitados, vencimiento, reportes privados, moderación y las pruebas previas de privacidad/pagos. `npm.cmd run test:e2e` prueba el ingreso visitante desde una franja menor, ausencia de envíos externos del cálculo, borrado al salir, entrada limitada decidida por servidor, propuesta pendiente y manual en cinco idiomas. Supabase/verificador están simulados en E2E; el SQL se ejecuta en PGlite con un fixture local, no en producción.

Se conservan los archivos existentes y no se crea commit. El staging incorpora el código, migraciones, pruebas y documentación necesarios para revisar esta funcionalidad y sus dependencias. Los archivos de entorno y las credenciales quedan excluidos; los recursos PNG de licencia no acreditada no se añaden a staging.
