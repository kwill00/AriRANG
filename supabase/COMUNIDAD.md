# Comunidad: activación pendiente

El frontend agrega Comunidad sin cambiar viajes, perfiles, propuestas ni las funciones administrativas. Publicaciones y debates se almacenan por separado de los proyectos existentes; no se publican borradores automáticamente. No se muestran nombres ni información privada del perfil.

## SQL que requiere autorización

Revisar `migrations/202610210001_comunidad.sql` y ejecutarlo primero en un proyecto Supabase de prueba. Su ejecución en producción requiere permiso explícito. No se ha ejecutado ninguna migración ni modificado datos remotos.

El archivo es una migración transaccional de una sola ejecución: si ya existen tablas con estos nombres, detenerse y comparar su esquema. No usar DROP ni reemplazar políticas existentes. Si se usa Supabase CLI, revisar el historial de migraciones antes de cualquier push: podría incluir otros cambios pendientes.

## Seguridad y comprobación antes de producción

Las tres tablas habilitan RLS, excluyen usuarios anónimos y permiten crear contenido únicamente con el ID del usuario autenticado. No se permite actualizar filas ni asignar fechas o IDs desde el cliente. Cada usuario puede borrar solo sus comentarios y reacciones. La clave primaria impide duplicar hearts. El texto se representa como texto React, sin HTML.

Lecturas: cualquier usuario autenticado puede ver el contenido y los UUID de sus autores y de las reacciones; no son datos anónimos. No se consultan correos ni perfiles privados. El admin existente conserva sus permisos; esta migración no le concede moderación comunitaria. Antes de abrir la comunidad al público conviene acordar moderación y límites contra spam.

En una base de prueba, con dos cuentas A/B y una sesión anónima, comprobar:

1. Anónimo no puede leer ni escribir ninguna de las tres tablas.
2. A puede publicar, comentar y reaccionar; B puede leer y responder.
3. A no puede insertar con el ID de B ni borrar comentarios/hearts de B.
4. No se pueden actualizar filas, falsificar fechas ni insertar textos fuera de los límites.
5. Dos hearts de A al mismo post producen una sola reacción; quitarlo no afecta a B.
6. Referencias a publicaciones inexistentes fallan. Los viajes y perfiles siguen siendo privados bajo sus políticas existentes.
7. En la app, comprobar publicación/debate, paginación, comentarios, eliminación propia, reacción y cierre/cambio de sesión.

Estas comprobaciones remotas están pendientes: compilar el frontend no valida RLS. No se incluyeron credenciales privilegiadas ni se consultó la base de producción. La seguridad de tablas y RPC preexistentes necesita una auditoría aparte con su SQL real.

## Actualizaciones

El feed se carga en páginas de 10 publicaciones y los comentarios en páginas de 20. El botón Actualizar feed obtiene los cambios de otras personas; no requiere habilitar Realtime. El formulario mantiene el texto si falla una solicitud. Hasta aplicar la migración, se muestra un aviso al consultar las tablas nuevas.
