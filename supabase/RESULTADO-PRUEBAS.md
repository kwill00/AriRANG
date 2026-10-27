# Resultado de la activación de Comunidad

Proyecto autorizado por el usuario como base de prueba: buhgdsnxmmoqshvoyyth.

Migración 202610210001_comunidad.sql aplicada mediante el editor SQL de Supabase. Se comprobó previamente que no existían tablas comunidad_*. No se modificaron tablas preexistentes.

Pruebas SQL ejecutadas con dos UUID de cuentas existentes y SET LOCAL ROLE authenticated/anon, sin iniciar sesión como esas personas ni leer sus datos personales. Resultado: PASS.

Verificado: RLS en las tres tablas; publicación, comentario y heart; lectura por la segunda identidad; bloqueo de suplantación y fecha enviada por cliente; bloqueo de UPDATE; rechazo de comentario vacío y referencia inexistente; heart único; protección de comentarios y hearts ajenos; eliminación propia; bloqueo de lectura anónima y escritura anónima de hearts.

Los registros de prueba se crearon dentro de una transacción terminada con ROLLBACK. No se crearon cuentas ni se enviaron correos. El script reproducible está en rls-pruebas.sql.

La ejecución fue manual en SQL Editor; no se registró en el historial de Supabase CLI. No volver a ejecutar la migración ni realizar db push sin reconciliar ese historial.

Este resultado reemplaza el estado de ejecución pendiente de COMUNIDAD.md para esta base de prueba. Producción sigue sin autorización. Pruebas de interfaz realizadas con sesión de prueba: publicación, debate, comentario, dar y quitar finger heart, persistencia tras recarga y carga de viajes, formulario de viaje, vuelos, proyectos, perfil y administración. No se probaron escrituras en las secciones preexistentes. Consola sin errores ni advertencias. Se corrigió el desborde de navegación y se verificó que el ancho del contenido no supera al de la ventana. Lint y compilación correctos. Permanecen dos publicaciones identificadas como [PRUEBA] y un comentario de prueba; estas pruebas de interfaz sí guardaron registros, a diferencia de las pruebas SQL con rollback. Paginación con múltiples páginas y cambio entre dos sesiones reales no se verificaron desde la interfaz.
