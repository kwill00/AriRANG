# Experiencia social

## Cambios aplicados

- Publicaciones y comentarios muestran el nombre social optativo y una inicial como avatar. Sin perfil visible, se muestra Miembro ARMY; para la persona autora se usa Vos. No se consultan perfiles privados ni datos de auth.users desde el frontend.
- Los perfiles se abren desde la firma de una publicación o comentario. Pueden cerrarse conservando la conversación.
- Los contadores Seguidores y Siguiendo abren listas paginadas de 20 perfiles, con controles para seguir/dejar de seguir y abrir otro perfil. Se puede volver al perfil anterior.
- Las listas públicas excluyen perfiles ocultos o no creados. El propietario de una lista Siguiendo puede cancelar una relación con un perfil oculto sin obtener su nombre o biografía.
- Los nombres se consultan por lote para cada página de publicaciones o comentarios. Una falla de esa consulta usa una etiqueta genérica; el texto de la conversación no depende de que exista un perfil social.

## Base y seguridad

Migración 202610210006_listas_sociales.sql aplicada manualmente en buhgdsnxmmoqshvoyyth, autorizado como base de prueba. No volver a ejecutarla; reconciliar el historial CLI antes de un db push.

Se agregó únicamente una función de consulta con autenticación obligatoria, search_path fijo, validación de parámetros y filtros explícitos de visibilidad. No se otorgó acceso directo a social_seguimientos ni se modificaron las políticas del perfil privado, viajes, administración, reportes o contadores verificados.

Los UUID de perfiles visibles se devuelven para navegar y gestionar relaciones; las listas sociales no son anónimas. Los nombres ocultos se excluyen y los totales pueden diferir del número de filas visibles. Un usuario puede consultar su propio perfil oculto y gestionar sus relaciones.

## Validación

- Lint y compilación correctos.
- conexiones-pruebas.sql ejecutado con dos identidades existentes, authenticated y anon: PASS. Seguidores/seguidos, nombres, privacidad de raíces y miembros ocultos, cancelación propia, validación de filtros/página y rechazo de acceso anónimo/directo a relaciones.
- Datos temporales de las pruebas SQL revertidos mediante ROLLBACK. No quedaron nuevos seguidores o perfiles de estas pruebas.
- Interfaz: nombres sociales comprobados en feed y comentarios; apertura de perfil desde comentario; expansión de seguidores; lista vacía, carga y controles de paginación. Consola sin errores ni advertencias en la comprobación final.
- Límites: la cuenta de interfaz no tiene conexiones persistentes. La navegación entre dos perfiles mediante una fila y la paginación con más de 20 conexiones no se recorrieron con datos reales en el navegador. La selección de perfiles y privacidad de filas se verificaron con las dos identidades en SQL.

El push continúa expresamente pendiente a petición del usuario. No se generaron claves, no se desplegó el emisor ni se creó un trabajo de envío. No se modificó producción.
