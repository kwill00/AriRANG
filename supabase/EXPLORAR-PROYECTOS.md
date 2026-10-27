# Exploración de proyectos

Comunidad permite buscar por título y combinar país, ciudad y concierto. El control Solo proyectos publicados excluye publicaciones generales. Los filtros geográficos y de concierto también limitan los resultados a proyectos publicados. Las tarjetas muestran los datos del proyecto original.

Las consultas se filtran en Supabase antes de paginar (10 publicaciones por página). Buscar y limpiar reinician la página. La coincidencia es parcial, sin distinguir mayúsculas; no normaliza abreviaturas ni acentos. Por ejemplo, un proyecto guardado como ARG se encuentra con arg, no necesariamente con Argentina. No se modifican las ubicaciones guardadas.

Se usa la relación existente entre comunidad_publicaciones y proyectos, con inner join cuando se filtran campos del proyecto. Se conservan las políticas RLS y los controles de borradores y contenido oculto. No se ejecutó SQL ni se modificaron datos remotos para esta etapa.

Validación: lint y compilación correctos; interfaz probada con título parcial bandera, país arg, ciudad caba y concierto arirang, obteniendo BANDERAZO. Se comprobaron solo proyectos, ciudad sin coincidencias, limpieza de filtros y búsqueda literal del símbolo %. Consola sin errores ni advertencias. La cuenta de prueba no tiene más de 10 resultados: navegación entre múltiples páginas no verificada con datos reales. El push sigue pendiente.
