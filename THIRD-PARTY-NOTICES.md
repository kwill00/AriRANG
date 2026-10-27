# Licencias y procedencia de recursos

Inventario local del 25 de octubre de 2026. No es una autorización sobre material de terceros ni una certificación legal.

## Fuentes

La interfaz usa Segoe UI, Arial, system-ui y alternativas del dispositivo. No hay archivos de fuentes descargados, Google Fonts, CDN de fuentes ni redistribución de fuentes en el código revisado. Los derechos de cada fuente y de los glifos de emoji corresponden a sus titulares; la aplicación utiliza las fuentes instaladas del dispositivo.

## Imágenes e iconos

Las ilustraciones nuevas de navegación e inicio en `src/components/TravelIllustration.tsx` son geometría SVG original incorporada al proyecto, sin imágenes descargadas, tipografías externas ni bibliotecas de iconos. Se conservan como código editable. La licencia general del proyecto queda a decisión de su titular; no se atribuye a estos dibujos una licencia de terceros.

| Recurso | Procedencia / licencia comprobada | Tratamiento |
| --- | --- | --- |
| `public/army-mark.svg` | Geometría original añadida al proyecto durante esta implementación; no copia una imagen externa ni usa una fuente | Nuevo icono utilizado por el HTML, manifiesto y notificaciones. No se atribuye afiliación oficial. La licencia general del proyecto sigue sin definirse por su titular. |
| `src/assets/hero.png` | Autoría, origen y permiso no documentados en el repositorio | No está importado por la interfaz. Conservar original; no reutilizar ni redistribuir hasta acreditar permiso. |
| `public/app-icons/*.png` | Autoría y permiso no documentados | Sustituidos en las referencias del manifiesto, HTML y service worker. Se conservan los archivos existentes y se excluyen del build mediante una lista de recursos aprobados en Vite. |
| `src/assets/react.svg`, `src/assets/vite.svg`, `public/favicon.svg` | Recursos de plantilla / marcas de React y Vite; falta copia específica de los avisos aplicables a estos archivos | No se usan en la interfaz actual. Conservar originales y revisar las condiciones de marca antes de reutilizarlos. |
| `public/icons.svg` | Sprite heredado con iconos de terceros; procedencia específica no documentada | Sin referencia en el código revisado y excluido del build, junto con `public/favicon.svg`. No asumir que la licencia de la biblioteca JavaScript cubre estas imágenes. |
| Avatares de usuarios / Google | No hay prueba de derechos aportada por el usuario | Solo se solicitan tras consentimiento de medios externos y por HTTPS a los hosts permitidos. Usar la imagen no acredita licencia. No se implementó subida de imágenes ni se verifica su titularidad. |
| Corazón de comunidad en `Comunidad.tsx` | Geometría SVG original incorporada el 27 de octubre de 2026 | Reemplaza el dibujo heredado sin procedencia documentada. No usa fuentes ni imágenes externas. |

## Dependencias

`docs/dependency-licenses.json` registra las declaraciones de licencia de los 198 paquetes del lockfile actual, incluidas herramientas de desarrollo y variantes por plataforma. Todos declaran licencia, pero esta declaración no sustituye revisar sus avisos y obligaciones. Hay MIT, Apache-2.0, ISC, CC-BY-4.0, BSD, MPL-2.0, BlueOak, 0BSD y la alternativa Apache-2.0/PostgreSQL de PGlite. El 26 de octubre se añadieron PGlite y Playwright únicamente para pruebas locales, sin incorporarlos al frontend publicado.

Los paquetes de runtime instalados son React, React DOM, scheduler, Supabase JS y sus módulos, iceberg-js y tslib. Sus avisos locales se recopilan en `docs/runtime-license-notices.txt`, con el texto original cuando está disponible. Regeneración: `node scripts/license-inventory.mjs`.

Las Edge Functions importan Supabase JS desde `npm:` y web-push 3.6.7. Estos paquetes no quedan fijados por el lockfile del frontend: antes de desplegar se debe generar y conservar un lockfile Deno, revisar las dependencias resueltas y sus licencias, y fijar versiones reproducibles. La instalación de las herramientas de prueba ejecutó la auditoría npm del lockfile, sin vulnerabilidades reportadas en ese momento; no equivale a un análisis del código ni de los servicios desplegados.
