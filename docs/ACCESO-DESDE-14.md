# Cuenta propia desde los 14 años

Decisión de producto del 26 de octubre de 2026: permitir cuentas de 14 a 17 sin verificación parental y reservar el flujo parental para menores de 14. Reemplaza el modelo inicial que exigía autorización para todas las cuentas de menores.

| Franja | Modalidad preparada |
| --- | --- |
| Visitante de cualquier edad | Planificador sin cuenta; importes solo en memoria |
| Menos de 14 | Sin registro independiente. Alta mediante admisión parental verificable, cuando se integre y habilite |
| 14–17 | Cuenta propia, correo/contraseña y aceptación informada separada de términos y privacidad; sin evento parental |
| 18 o más | Ruta adulta existente |

Las cuentas adolescentes pueden usar el planificador y la comunidad con revisión previa. Se mantienen reportes privados y controles de contacto, vocabulario y frecuencia. No acceden al directorio de perfiles ni a mensajes privados, push o pagos. Que puedan crear una cuenta no permite publicar sin revisión ni sustituye la confirmación de correo configurada en Supabase.

## Implementación

La migración `202610260002_acceso_desde_14.sql` añade `teen_declared` y franjas `under14`, `teen`, `adult`, `unknown` en datos privados. El registro de adolescentes queda grabado por un trigger del servidor a partir de la solicitud válida. El cliente no puede escribir directamente esos datos privados ni otorgarse permisos usando `user_metadata` después del alta.

Se registra consentimiento propio de la versión `2026-10-26.2`; no se fabrica un consentimiento parental ni se exige uno a la ruta 14–17. `privacy_accept_teen` permite revisar el acceso de cuentas existentes que no estén clasificadas como menores de 14 ni revocadas. El permiso adolescente no satisface el permiso adulto ni el de pagos. Deshabilitar la modalidad en servidor retira el acceso adolescente y sus publicaciones del feed limitado.

Las cuentas históricas con un caso parental y una franja `unknown` no se convierten automáticamente: antes el selector agrupaba 13–17 y esa información no permite saber si la persona ya tiene 14. Requieren aclarar la clasificación mediante un proceso de servidor revisado, sin inventar una fecha de nacimiento. Una cuenta conocida como `under14` o revocada no puede cambiarse a adolescente solo seleccionando otra opción. El paso de una cuenta conocida como adolescente al área adulta tampoco se concede por editar metadatos.

Los registros independientes siguen guardando una declaración de franja, **no una verificación de edad o identidad**. Se puede mentir en una autodeclaración. No se añadieron documentos, biometría, fecha exacta de nacimiento ni un proveedor de verificación como sustituto oculto del proceso parental.

## Activación y alcance jurídico

La nueva configuración `teen_self_access_enabled` empieza en `false`. Para habilitarla, el servicio también debe tener `public_ready` y `minors_enabled` en `true`, políticas completas y operación de moderación. Esta entrega no cambia esos valores en la base conectada ni despliega las migraciones.

El umbral de 14 es una regla de producto solicitada, **no una afirmación de cumplimiento jurídico universal**. Para Argentina, el [criterio 5 de la Resolución AAIP 4/2019](https://www.argentina.gob.ar/normativa/318874_res4AAIP_pdf/archivo) considera la autonomía progresiva y la capacidad para prestar consentimiento informado; no establece que cumplir 14 resuelva automáticamente cualquier tratamiento de datos. La [nota de AAIP de 2024](https://www.argentina.gob.ar/node/436471) describe además un umbral de 16 dentro de un proyecto legislativo: no se utiliza aquí como si fuera una ley vigente.

Antes de activar para personas reales hay que definir los países atendidos, revisar la base jurídica y las medidas proporcionales de validación de identidad/edad y comprensión, completar responsable/contacto, retención y capacidad humana de moderación. No se necesita contratar un verificador parental para la ruta adolescente por el solo hecho de implementar este modelo; la revisión puede exigir otros controles según la jurisdicción y el uso. El mecanismo parental sigue siendo necesario para la modalidad del proyecto de menores de 14.

## Pruebas y Git

Resultado de esta revisión: **46 pruebas de lógica/SQL y 15 E2E aprobadas**; lint y compilación correctos. El build conserva una advertencia de tamaño de bundle. Ninguna prueba creó cuentas reales ni movió dinero.

Las pruebas SQL cubren el alta adolescente sin evento parental, consentimiento incompleto, versión antigua, bandera de servicio deshabilitada, casos under-14/revocados y moderación/retirada de publicaciones. Las pruebas de navegador verifican las franjas nuevas, los campos propios sin datos parentales y la ausencia de una solicitud de alta cuando la modalidad no está habilitada. Son pruebas locales con fixtures: no un alta infantil real ni una validación del esquema de producción.

Se actualizan los archivos relacionados en staging, conservando los demás cambios y sin crear commit. Se mantienen excluidos los archivos de entorno y las credenciales.
