# Diseño móvil

Aplicado en el frontend: menú móvil compacto y persistente con apertura/cierre accesibles, cierre al seleccionar sección y regreso al inicio de la página; formularios desplegables para publicar y filtrar en Comunidad; resumen de filtros activos con opción de quitarlos; controles táctiles de al menos 44 px de alto; campos a 16 px, tarjetas y formularios adaptados al ancho; respeto de áreas seguras y reducción de movimiento. La bienvenida de viajes queda solo en Inicio para no repetirse debajo de cada sección. Documento HTML en español y título de ARMY Travel.

Se corrigió el min-width antiguo del body que provocaba desplazamiento horizontal al probar 320 px con barra de desplazamiento.

Verificación en navegador con viewport 390×844, 320×740 y 1200×900. Menú, navegación, cierre automático, búsqueda, resumen de filtros, perfiles anidados/listas vacías y buscador de vuelos comprobados. Sin desborde horizontal en las vistas pequeñas verificadas; botones visibles medidos sin alturas inferiores a 44 px. Escritorio conserva menú completo y formularios visibles. Se restauró el tamaño normal del navegador después de las pruebas.

Lint y compilación correctos tras el último cambio. Consola sin errores ni advertencias al comprobar el estado final. No se ejecutó SQL ni se modificaron datos remotos. No se enviaron formularios que escriban en la base durante estas comprobaciones.

La comprobación fue con dimensiones de navegador, no en teléfonos físicos. No se probó el teclado virtual de iOS/Android ni todas las vistas administrativas en dispositivos reales. El push continúa pendiente por indicación del usuario.
