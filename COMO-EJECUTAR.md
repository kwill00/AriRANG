# Ejecutar ARMY Travel en Windows

1. Abrir la carpeta C:\Users\CamiloT\Documents\army-travel.
2. Hacer doble clic en INICIAR-ARMY.cmd.
3. Abrir en el navegador la dirección Local que muestre la ventana: normalmente http://127.0.0.1:5173/. Si ese puerto está ocupado, Vite elige otro y lo indica.
4. Mantener la ventana abierta. Para detener el servidor, presionar Ctrl+C y confirmar si Windows lo pregunta.

No es necesario instalar dependencias cada vez. Si se copia el proyecto a otra computadora, instalar Node.js compatible con Vite y ejecutar npm ci en la carpeta. Las variables VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY deben estar configuradas en .env.local. No compartir ese archivo ni agregar credenciales privilegiadas al frontend.

Alternativa desde PowerShell:

```powershell
cd C:\Users\CamiloT\Documents\army-travel
npm run dev -- --host 127.0.0.1
```

## Vista móvil

La interfaz se adapta a pantallas chicas y puede previsualizarse en las herramientas de dispositivo del navegador. Esa vista es la aplicación real con ancho reducido. La dirección 127.0.0.1 funciona únicamente en la computadora donde corre Vite: abrirla en el teléfono apunta al teléfono, no a la PC. Para compartir con usuarios se necesita publicar en un sitio HTTPS. Eso y el push quedan pendientes; no están activados por el cambio visual.

El desarrollo local usa la base Supabase configurada; no es una maqueta sin conexión. Los pagos reales y las transferencias automáticas continúan sin habilitar.

## Cambio visual verificado

Se agregó theme.css, marca en escritorio, tarjetas con mejor jerarquía, acciones lilas, formularios desplegables tanto en móvil como escritorio y fondos suaves. Se retiró la bienvenida duplicada de Inicio. No se modificaron políticas ni datos en Supabase.

Lint y build correctos. Verificación de Comunidad en 390 px y 320 px, sin desborde horizontal a 320 px; vista escritorio en 1200 px. Consola sin errores ni advertencias en la comprobación final. No se probó en un teléfono físico.
