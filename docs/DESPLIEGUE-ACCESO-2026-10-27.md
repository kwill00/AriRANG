# Registro de migraciones de acceso

Proyecto de producción: `buhgdsnxmmoqshvoyyth`. Fecha: 27 de octubre de 2026.
Instalación autorizada por el operador, mediante CLI y Management API.

| Archivo instalado | SHA-256 de los bytes locales |
| --- | --- |
| `202610250001_privacidad.sql` | `FC79AE13BE031C25F7EFE7054C2D22C091A829865440559ABB10283A7D5FACDD` |
| `202610260001_menores_conducta.sql` | `9E593FA71F73D710B70D5DBE9C2E9C0FA16B9606CC28494F6FC153B331332415` |
| `202610260002_acceso_desde_14.sql` | `F5283598EF2676F3168118E1CD1CDDEC76540288A8A07E352BE31017B6482A7A` |

Los cuerpos se ejecutaron juntos, sustituyendo los límites individuales de
transacción por un único BEGIN/COMMIT, después de un ensayo con ROLLBACK.
Se añadió notificación de recarga de esquema de PostgREST. No se modificó el
contenido de las migraciones versionadas.

Validación: diagnóstico SQL con todas las funciones presentes; consultas REST de
disponibilidad adulta/adolescente válidas y en `false`; verificación SQL de rechazo
de acceso sin aceptación y aislamiento del esquema privado, con rollback.

Estado final: versión `2026-10-26.2`, acceso público y de menores deshabilitado,
eliminación no habilitada. No equivale a lanzamiento público, despliegue de Edge
Functions ni publicación del frontend. Ver `CONFIGURAR-ACCESO-SERVIDOR.md` para
configuración pendiente, inventario previo y reconciliación del historial.
