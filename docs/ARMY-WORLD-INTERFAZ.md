# ARMY World: marca e interfaz local

27 de octubre de 2026. Se cambia la marca visible ARMY Travel por ARMY World en
inicio, acceso, instalación, títulos, políticas, traducciones, avisos y manifiesto.
El monograma SVG original pasa de AT a AW, conservando su ruta y sin fuentes externas.

Actualización posterior: el ícono AW se reemplaza por una ilustración SVG original
del gesto coreano de corazón con los dedos: mano en tonos cálidos, pequeño corazón
rosado y fondo lila. Se conserva `public/army-mark.svg`, de modo que el encabezado,
favicon, manifiesto e indicaciones de notificación comparten el nuevo dibujo.

El encabezado reúne la marca, la instalación y el selector de idioma. Se retira
la cabecera de marca duplicada dentro de la aplicación autenticada. Se rediseñan
tarjetas de navegación, pie, manual de convivencia y panel de privacidad con
superficies claras, bordes suaves, botones redondeados e iconos SVG propios.
Aceptar y rechazar opcionales tienen el mismo color, tamaño mínimo y jerarquía.
Configuración y revocación siguen disponibles sin exigir aceptar cookies.

Se conservan claves de sesión/consentimiento, identificadores técnicos, nombres
de funciones, rutas, referencias Supabase y dominios. No se renombra la carpeta
army-travel ni se cambia la URL de producción. Los textos históricos de despliegues
anteriores permanecen como registro de su marca original.

Validación: 71 pruebas de lógica/SQL, 24 E2E, lint y build correctos; comprobación
visual de capturas de escritorio y 320 px. El navegador de pruebas usa red externa
simulada. Se verifican la marca, el manifiesto, instalación, igualdad visual de
aceptar/rechazar y persistencia de preferencias después de recargar.

Cambio exclusivamente local/GitHub; no se desplegó a Netlify ni Supabase. El nuevo
nombre en textos de las funciones de prueba llegará al servidor cuando se haga
un despliegue autorizado posterior. No cambia los permisos ni activa pagos.

## Administración y controles compactos

El pie pasa a una fila en escritorio, con enlaces y botones de 44 px de área
interactiva; se reduce el espacio visual del manual. Avisos muestra campana,
etiqueta y contador separados. El límite de 20 se explica dentro del panel y en
su nombre accesible, en lugar de alargar el botón cerrado.

Administración se organiza en cuatro pestañas: revisión previa, reportes,
solicitudes y pagos de prueba. Incluyen semántica ARIA, navegación con flechas,
Home/End, formularios agrupados, estados vacíos y carga visible. Los componentes
permanecen montados para conservar filtros y entradas al cambiar de sección.
Los registros externos se abren por separado y el retorno de Mercado Pago sigue
seleccionando la sección de pruebas. Se conservan permisos, confirmación de
solicitudes y motivo obligatorio de moderación. No se ejecutan mutaciones al
cambiar de pestaña.

Validación de esta etapa: 71 pruebas de lógica/SQL, 26 E2E, lint y build correctos.
Las nuevas pruebas cubren teclado, ancho 320 px, contador de Avisos, pie compacto,
moderación con motivo, cancelación de solicitudes y acceso restringido al checkout.
Se revisaron capturas con contenido ficticio en escritorio y móvil. No se modificó
ninguna base ni se desplegó el sitio.
