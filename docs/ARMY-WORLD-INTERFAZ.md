# ARMY World: marca e interfaz local

27 de octubre de 2026. Se cambia la marca visible ARMY Travel por ARMY World en
inicio, acceso, instalación, títulos, políticas, traducciones, avisos y manifiesto.
El monograma SVG original pasa de AT a AW, conservando su ruta y sin fuentes externas.

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
