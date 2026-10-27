# Proyectos, perfiles y avisos

## Aplicado en la base de prueba

Proyecto: buhgdsnxmmoqshvoyyth. Migraciones 003, 004 y 005 ejecutadas manualmente en SQL Editor. No volver a ejecutarlas. Reconciliar el historial antes de usar Supabase CLI db push.

Los proyectos publicados existentes se incorporaron al feed. Un trigger incorpora futuras publicaciones y sincroniza título/descripción sin duplicar la conversación ni reiniciar la moderación. Los borradores no se incluyen. Cada proyecto usa comentarios, debates, hearts y reportes existentes de Comunidad. El estado original del proyecto no se modifica.

Los perfiles sociales se crean de manera optativa con campos separados del perfil privado. No se copian correos, viajes, roles ni datos privados. Las personas con sesión pueden descubrir los perfiles visibles y seguirlos. Cada seguidor puede dejar de seguir incluso un perfil oculto. Las relaciones de seguimiento no se exponen como listas de UUID; se consultan contadores.

Solo administración registra donaciones verificadas y suscripciones pagas verificadas mediante RPC. No se almacenan importes monetarios ni datos bancarios. Una donación usa una referencia única. Una suscripción identifica suscriptor, perfil y fecha de vigencia; las renovaciones actualizan su vigencia. El contador incluye únicamente suscripciones con referencia y vigencia futura. No se convierten suscripciones gratuitas en pagas y no hay botón para suscribirse gratis. El registro manual requiere verificar el pago externo: no es un procesador de cobros ni una integración de pagos automática.

Cada nueva publicación genera avisos para sus seguidores actuales, siempre que el perfil sea visible. El backfill inicial de proyectos no genera avisos retroactivos. Los avisos son privados por RLS y se consultan cada 30 segundos en la app. Actualizaciones de una publicación y restauraciones no disparan avisos duplicados.

## Validación

Lint y compilación del frontend correctos. social-pruebas.sql se ejecutó con identidades de admin y usuario común existentes y roles authenticated/anon. PASS: borradores privados, sincronización al publicar, conversación y hearts del proyecto, seguidores sin duplicados, avisos privados, bloqueo de registros monetarios por usuarios comunes, contadores verificados, perfil oculto y claves push privadas. Los registros temporales de estas pruebas se revirtieron con ROLLBACK.

Interfaz comprobada: abrir el proyecto publicado BANDERAZO desde Mis proyectos; conversación filtrada con sus controles; crear y editar un perfil social separado; encontrarlo en ARMY conectadas y mostrar sus contadores sin importes. Queda un perfil identificado como perfil de prueba, sin copiar datos privados. No se simularon pagos reales en la interfaz. Separación de permisos probada en SQL; no se inició sesión con la segunda cuenta desde la interfaz.

## Push: preparado, todavía no activo

El registro de dispositivos está creado y protegido. Se prepararon public/social-push-sw.js, el botón de activación voluntaria y supabase/functions/social-push/index.ts. El emisor vuelve a comprobar seguimiento, visibilidad y publicación antes de enviar un mensaje genérico sin datos personales. Rechaza endpoints ajenos a los proveedores de push admitidos, elimina endpoints vencidos y limita reintentos. La entrega es al menos una vez; el identificador de notificación agrupa reintentos en el dispositivo. Los registros sin dispositivo no se envían retroactivamente después de procesarse.

No se generaron claves VAPID ni secretos de envío, no se desplegó la Edge Function ni se creó el trabajo programado. La función no fue probada en el runtime Deno: lint y build no confirman funcionamiento del envío. Es necesaria una prueba real en el dispositivo antes de afirmar que push funciona.

Para activar:

1. Definir el sitio HTTPS que usarán los teléfonos. 127.0.0.1 solo funciona en la misma computadora. Agregar manifest e instalación si el navegador móvil lo requiere.
2. Generar una pareja VAPID y guardar VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT en secretos de la función; el subject debe ser un contacto válido del responsable. VITE_WEB_PUSH_PUBLIC_KEY es la única clave que va al frontend. Nunca publicar VAPID_PRIVATE_KEY, service_role ni SOCIAL_PUSH_JOB_SECRET.
3. Desplegar social-push en la base de prueba y configurar SOCIAL_PUSH_JOB_SECRET como secreto largo y aleatorio. El handler exige POST y Authorization: Bearer con ese secreto. Si se usa ese token propio, configurar la función para delegar la validación al handler en vez de exigir JWT de usuario; no quitar la comprobación del secreto del código.
4. Guardar el secreto del trabajo en Supabase Vault y programar la invocación cada minuto con pg_cron/pg_net. No duplicar trabajos existentes. No ejecutar dos emisores simultáneos: la cola no usa leases distribuidos y podría reenviar durante una superposición.
5. Cada persona pulsa Activar push en su dispositivo y acepta el permiso del navegador. Probar seguimiento, nueva publicación, aviso con app cerrada, desactivación, perfil oculto y contenido moderado. El dispositivo también puede bloquear avisos por preferencias del sistema o ahorro de batería.
6. En equipos compartidos, desactivar push antes de cambiar de cuenta. No se transfieren endpoints entre cuentas automáticamente.

Referencias: https://supabase.com/docs/guides/functions/schedule-functions y https://github.com/web-push-libs/web-push.

La activación de claves, emisor y planificación necesita completar esta configuración; no se debe prometer entrega al teléfono mientras siga pendiente.
