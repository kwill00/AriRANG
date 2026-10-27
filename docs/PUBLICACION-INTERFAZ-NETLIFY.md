# Publicación de interfaz del 27 de octubre de 2026

- Sitio: `quiet-kelpie-28a2b2` (`c8e0ba77-7ffc-4077-97f4-8eaa0856be85`).
- URL: https://armytravellatam.com
- Deploy confirmado: `6ae0cdd6bfbffcb441353a5c`.
- Permalink: https://6ae0cdd6bfbffcb441353a5c--quiet-kelpie-28a2b2.netlify.app
- Deploy anterior observado: `6ae02cdc59f11cbf1aa95ada`.
- Bundle publicado: `/assets/index-DrDpq4g1.js`.

Se compiló el árbol de trabajo actual, incluidos los cambios existentes de Google
y checkout administrativo de Mercado Pago. Se preservaron el staging, los cambios
sin preparar y los archivos no relacionados. No se creó commit ni se subió a Git:
el repositorio continúa sin remoto configurado.

Se ejecutaron 58 pruebas de lógica/SQL y 22 pruebas E2E, lint y build, todos correctos.
Continúa la advertencia de tamaño del bundle. Las pruebas de navegador simulan los
servicios externos y no acreditan una compra de prueba completada en Mercado Pago.

El deploy CLI se realizó sin reconstrucción remota, usando el `dist` verificado y
`netlify.toml`. Se compararon hashes SHA-256 de los archivos remotos y locales del
bundle, manifiesto, service worker y avisos de runtime. La portada referencia la
compilación nueva y conserva las cabeceras CSP, no-referrer y nosniff.

El artefacto excluye imágenes públicas de licencia pendiente; conserva los
originales en la carpeta. No se publicaron archivos de entorno ni código de servidor.

Mercado Pago tiene dos funciones de prueba desplegadas y activas con JWT. El
checkout visible en Administración es solo de prueba, sin split ejecutado.
No se modificaron secretos ni se crearon preferencias o pagos en esta publicación.
No se habilitaron cobros reales. El registro público adulto y adolescente continúa
deshabilitado en Supabase, según las consultas públicas posteriores al despliegue.
