# SDK y servicios de terceros

Actualización de acceso del 26 de octubre: la ruta de cuenta propia 14–17 no incorpora SDK parental ni comparte datos con un nuevo proveedor. Las referencias anteriores a verificación parental quedan aplicadas al modelo de menores de 14 y a casos históricos. Detalle: `ACCESO-DESDE-14.md`.

Revisión estática local del 25 de octubre de 2026. No se inspeccionaron cuentas remotas, tráfico de producción, contratos, residencia ni retención reales. No equivale a pentest o análisis de vulnerabilidades.

| Componente / servicio | Datos y finalidad observados | Decisión / requisito |
| --- | --- | --- |
| React / React DOM 19.3.1 y scheduler | Render de interfaz; sin servicio remoto propio | Sin telemetría agregada por el proyecto. Paquetes existentes, sin actualizar. |
| Supabase JS 2.118.0: Auth | Correo, contraseña para autenticación, tokens en almacenamiento local y metadatos declarados de registro | Necesario para las funciones de cuenta. No se usa cookie promocional para la sesión. No se imprimen claves ni tokens. Revisar SMTP, confirmación, logs y proveedores en el dashboard. |
| Supabase PostgREST / Functions | Perfiles, viajes, presupuestos, contenido social, solicitudes, reportes y controles de cuenta | Necesario por función. RLS y validación del bearer en servidor; no basta el filtrado de React. Cambios de servidor preparados, no aplicados. |
| Supabase Realtime / Phoenix | Dependencias incluidas por Supabase JS | No se encontró uso de canales Realtime. Avisos consulta cada 30 segundos. No se agregó seguimiento ni se activaron canales. Revisar configuración remota aparte. |
| Supabase Storage / iceberg-js | Dependencias del SDK; URL de avatar eventualmente alojada en Supabase | No se implementó subida. La carga de avatares queda tras permiso externo. Restricción de Storage preparada; verificar buckets públicos y objetos heredados antes de publicar. |
| Google OAuth | Antes podía crear cuentas con metadatos y avatar | Retirado de la interfaz. Deshabilitar también el proveedor en Supabase hasta diseñar una ruta de edad revisada. Datos históricos no se borran automáticamente. |
| `lh3.googleusercontent.com` | IP y cabeceras de conexión al solicitar avatar | Opcional, bloqueado por defecto, HTTPS y host exacto, `no-referrer`, revocable. Sin píxeles arbitrarios. |
| Push: web-push 3.6.7, FCM / Mozilla / Apple / Windows | Endpoint y claves técnicas de suscripción, entrega de aviso genérico | Opcional, consentimiento propio + permiso de navegador + acción en Avisos. No se activó emisor, cron ni VAPID. Emisor actualizado verifica elegibilidad. No enviar contenido privado en notificaciones. |
| Service worker y Cache API | Pantalla estática sin conexión | No cachea contenido de cuenta ni solicitudes API. No se considera analítica. La instalación del worker no solicita por sí sola permiso push. |
| Alojamiento / Netlify | Solicitudes de archivos, datos técnicos y posibles logs | Proveedor efectivo de producción sin confirmar. Cabeceras preparadas; revisar snippets, analítica, logs, regiones, retención y contratos fuera del repositorio. |
| Correo transaccional Supabase / SMTP | Dirección y mensajes de acceso/recuperación solicitados | Proveedor y retención no confirmados. No hay campaña promocional. La supresión local de servidor debe integrarse si se añade un emisor comercial. |
| Verificación parental | Sin proveedor integrado | Adaptador HMAC preparado, sin documentos. No verifica identidad por sí mismo. Las cuentas de menores no se abren. |
| Analítica, publicidad, mapas, CDN de fuentes, traductor externo, reseñas o pasarela de pago | No se encontró integración activa en el código revisado | No se añadieron. Revisar igualmente inyecciones de infraestructura en producción. El buscador de aeropuertos utiliza una lista local. |

El lockfile conserva las versiones existentes. El inventario de licencias está en `dependency-licenses.json`; los avisos runtime en `runtime-license-notices.txt`. Las importaciones `npm:` de Edge Functions requieren lockfile y revisión de dependencias propios antes de desplegar.
