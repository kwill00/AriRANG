# Pruebas y preparación de pagos y menores

**Última revisión de acceso:** [Cuenta propia desde los 14](ACCESO-DESDE-14.md). La autorización parental se reserva a menores de 14; la ruta adolescente mantiene moderación y restricciones financieras.

**Actualización posterior del 26 de octubre:** se incorporó acceso visitante y un espacio limitado para cuentas de menores con permisos parentales, más moderación previa y manual. Ver [Acceso de menores y commit](ACCESO-MENORES-Y-COMMIT.md). Las cuentas reales requieren verificación/configuración externa; el modo visitante ya funciona sin cuenta. Los resultados históricos de esta página preceden esas pruebas nuevas.

Actualizado: 26 de octubre de 2026. El usuario confirmó **preparar pagos reales con activación posterior** y que **todavía no tiene proveedor contratado**. El plan existente parte de Argentina y organizadoras de LATAM; la lista de países atendidos sigue por confirmar. No se activaron cobros, contratos, altas infantiles, despliegues ni migraciones en Supabase.

## Resultados reproducibles

| Comprobación | Resultado | Alcance real |
| --- | --- | --- |
| `npm.cmd test` | 35 aprobadas | Reparto, preparación de pagos, privacidad, autorización de endpoints y SQL local |
| `npm.cmd run test:e2e` | 10 aprobadas en Chrome aislado | Formularios, cinco idiomas, cookies, foco/Escape, menores, avatares, eliminación rechazada, teclado y anchos 320/1280 px |
| `npm.cmd run lint` | Sin errores ni advertencias | Código y herramientas del repositorio |
| `npm.cmd run build` | Correcto | Compilación TypeScript y bundle; puede informar tamaño superior a 500 kB |

Las pruebas E2E usan variables Supabase ficticias y un perfil nuevo de navegador. Todas las solicitudes de aplicación fuera de localhost se interceptan o bloquean; no utilizan sesiones, credenciales ni datos reales. Los service workers se deshabilitan en este contexto de pruebas. Por eso no prueban entrega push, caché offline, SMTP ni OAuth real. Capturas de 320 y 1280 px en `test-results/`, excluido de Git; se revisó visualmente la captura móvil.

PGlite ejecuta las ocho migraciones SQL del repositorio en memoria. El fixture sustituye Auth, Storage y las tablas heredadas de perfiles, viajes, proyectos y solicitudes. Ejecuta PostgreSQL real compilado a WASM, pero **no reproduce el esquema completo ni los servicios de la instancia conectada de Supabase**. Las once pruebas SQL cubren:

- Denegación por defecto, aceptación adulta vigente y rechazo de autoascenso de un menor conocido.
- Restricciones por rol en tablas, vistas y RPC privilegiadas, incluso ante un grant heredado a PUBLIC.
- Ocultación de contenido de cuentas sin revisar y consentimiento independiente para mostrar perfiles.
- Eventos parentales solo por servicio, firma HMAC real con un proveedor simulado, rechazo de cuerpos manipulados y replay, revocación y acceso infantil todavía cerrado después de un evento verificado.
- Baja privada sin crear consentimientos falsos, preflight de eliminación, rechazo de archivos pendientes, cascadas de datos del fixture y rechazo posterior del identificador de un usuario borrado.
- Trigger de registro que rechaza metadatos incompletos o declarados como menores independientemente del formulario.

Se corrigió un caso límite encontrado al ampliar la cobertura: `privacy_restrict_minor()` preserva el estado `revoked`; volver a elegir una franja de edad no permite reabrir un caso parental revocado. La corrección está en la migración local todavía no desplegada.

En el entorno restringido de Codex, el runner E2E terminó sus casos pero quedó esperando el cierre de su proceso servidor. La ejecución autorizada fuera de esa restricción cerró correctamente y devolvió código 0. No se desactivaron certificados TLS: npm se ejecutó con `--use-system-ca` para usar la confianza del sistema. Se añadieron PGlite y Playwright solo como herramientas de desarrollo, con lockfile.

## Lo que se empezó para pagos

`supabase/functions/_shared/payment-safety.ts` implementa preparación interna del servidor y transiciones de un registro **sandbox en memoria**, sin checkout ni llamadas a un procesador:

- Cuenta autenticada declarada adulta, política vigente, organizadora aprobada, cuenta de proveedor y país habilitados como requisitos de contexto confiable.
- Producto/importe/periodicidad del catálogo del servidor, nunca porcentaje o destinatario calculado por el navegador.
- Reparto 80/20 existente, total explícito, cero cargos adicionales al comprador y costos absorbidos por la plataforma dentro de su parte. Si los costos superan su parte, requiere revisión de financiación; no reduce la parte de la organizadora.
- Protección frente a autoaportes, importes inválidos y recurrencia incoherente; clave de idempotencia con formato validado.
- Transiciones de pago, fallo, reembolso y disputa con eventos idempotentes, comprobación de moneda/importe/orden/pago y rechazo de eventos atrasados que pretendan reactivar un pago reembolsado.
- Producción siempre rechazada en esta etapa. Un menor con evento parental verificado tampoco queda autorizado para un contrato financiero.

Las siete pruebas nuevas de esta capa y las cuatro anteriores de reparto son **simulaciones internas**, no pagos sandbox confirmados por dLocal ni otro proveedor. El reductor exige que un futuro adaptador verifique firma y consulte el estado de pago con el proveedor; por sí solo no autentica un webhook. No hay persistencia transaccional de órdenes, idempotencia distribuida, checkout, cancelación remota, liquidación, conversión de moneda ni actualización de contadores desde pagos automáticos todavía.

## Requisitos para la siguiente integración

1. Seleccionar y obtener acceso comercial/sandbox de un proveedor que acepte al operador y el modelo de plataforma, países, aportes y recurrencia con reparto. dLocal for Platforms sigue siendo un candidato, no una cuenta contratada ni una decisión tomada. Sus [reglas de split y comisiones](https://docs.dlocal.com/docs/split-payments-platforms) y [configuración de plataformas](https://docs.dlocal.com/docs/payment-configuration-platforms) deben confirmarse para el contrato concreto.
2. Definir países iniciales, planes/precios, moneda efectiva de cobro y liquidación, cancelación, reembolsos y responsabilidad por disputas. No basta con que una API admita expresar un importe en USD.
3. Obtener onboarding/KYC de organizadoras mediante el proveedor, sin solicitar documentos ni bancos en el formulario público. Preparar catálogo y órdenes privadas, claves de idempotencia únicas en base, contabilidad de reembolsos y conciliación.
4. Implementar el adaptador del proveedor elegido, checkout alojado, webhook con su protocolo de firma y confirmación de estado por API. Probar pago aprobado/rechazado, repetición de eventos, reembolsos, disputas, renovaciones y cancelaciones en su sandbox antes de una activación real.
5. Probar las migraciones contra una copia sanitizada del esquema real de Supabase y desplegar a staging. Los fixtures locales no habilitan a cambiar `public_ready` o `deletion_reviewed` en producción.
6. Para menores: seleccionar un mecanismo parental verificable, definir países y edades, identidad y responsabilidad del adulto, avisos por finalidad, retirada, borrado y derechos sin sesión. El adaptador HMAC probado recibe evidencia referenciada, pero no acredita por sí mismo parentesco o identidad. El alta de menores y los pagos de menores siguen cerrados.
7. Completar responsable/contacto, retención, licencias pendientes, sitio HTTPS y configuración de proveedores antes de publicar. No compartir secretos en el chat; configurarlos solo por los mecanismos seguros del servicio cuando exista la integración.

No puede afirmarse que todo el producto esté probado en producción: faltan la instancia real de Supabase, APIs de pago, verificador parental, Netlify, entrega de correos/push, dispositivos físicos y revisión con lector de pantalla. El trabajo actual deja pruebas repetibles y los requisitos técnicos identificados para continuar sin movimientos de dinero ni datos infantiles reales.
