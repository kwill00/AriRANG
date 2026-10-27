# Inicio y navegación ilustrados

Cambio visual del 26 de octubre de 2026:

- La navegación usa tarjetas con miniilustraciones SVG, colores por sección e indicador de página activa.
- Inicio incorpora una cabecera con billete y avión y cuatro accesos grandes: planificar viaje, ver viajes, crear propuesta y comunidad. Los accesos conservan la navegación existente y no descartan formularios.
- La pantalla de entrada incluye una ilustración y una tarjeta para entrar como visitante.
- Dibujos originales en código, sin imágenes remotas, bibliotecas de iconos, fuentes descargadas ni nuevos permisos.
- Etiquetas accesibles y foco visible conservados; SVG decorativos ocultos al lector de pantalla. Animaciones solo cuando no se solicita movimiento reducido.
- Nuevos textos disponibles en los cinco idiomas. Menú móvil en dos columnas y tarjetas adaptadas a 390 y 320 px.

Verificación: lint y compilación correctos; 46 pruebas de lógica/SQL y 16 pruebas de navegador aprobadas. Se verificaron las acciones de los accesos, la página activa y la ausencia de desborde horizontal. Se revisaron las capturas de escritorio, móvil y menú móvil abierto. Las capturas usan datos ficticios y están en `test-results/`, excluido de Git.

Los cambios relacionados quedan preparados en staging, sin crear commit. No se alteran permisos de menores, políticas de servidor ni pagos. No se publica ni despliega el sitio.
