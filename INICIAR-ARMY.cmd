@echo off
title ARMY Travel - Desarrollo local
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instala Node.js LTS y volve a abrir este archivo.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo Faltan las dependencias. Ejecuta npm ci en esta carpeta antes de continuar.
  pause
  exit /b 1
)
echo Abri en el navegador la direccion Local que aparezca debajo.
echo Conserva esta ventana abierta mientras uses ARMY Travel.
echo Para detener la aplicacion, presiona Ctrl+C.
call npm run dev -- --host 127.0.0.1
pause
