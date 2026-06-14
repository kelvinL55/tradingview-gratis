@echo off
title Iniciar TradingView Gratis
echo ======================================================
echo           INICIANDO TRADINGVIEW GRATIS
echo ======================================================
echo.

cd /d "c:\Users\Kelvin\Documents\tradingview-gratis"

:: Verificar si node_modules existe, si no, instalar dependencias
if not exist node_modules (
    echo [INFO] No se detecto la carpeta node_modules. Instalando dependencias...
    echo Esto puede tardar un momento en la primera ejecucion...
    call npm install
)

:: Abrir el navegador en localhost:3000
echo.
echo [INFO] Abriendo el navegador en http://localhost:3000 ...
start http://localhost:3000

:: Iniciar el servidor de Next.js
echo [INFO] Iniciando el servidor local...
call npm run dev

pause
