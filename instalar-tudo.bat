@echo off
title TigoSecToolkit - Instalador Completo
echo ===================================================
echo   🛡️ TigoSecToolkit - Instalador Automatizado 🛡️
echo ===================================================
echo.
echo Iniciando instalacao das dependencias e ferramentas portaveis...
echo.

cd core
call npm install
call npm run setup

echo.
echo ===================================================
echo   ✅ Setup completo! O aplicativo esta pronto.
echo ===================================================
pause
