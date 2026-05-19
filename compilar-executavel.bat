@echo off
title TigoSecToolkit - Compilar Executavel
echo ===================================================
echo   📦 TigoSecToolkit - Gerando Executavel (.exe) 📦
echo ===================================================
echo.
echo Compilando e empacotando o aplicativo para Windows...
echo.

cd core/gui
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npm run dist

echo.
echo ===================================================
echo   Criando atalho na raiz do projeto...
echo ===================================================
echo.

powershell -NoProfile -Command ^
  "$exe = Get-ChildItem -Path '%~dp0core\gui\release\*.exe' | Where-Object { $_.Name -like '*Portable*' -or ($_.Name -like '*TigoSecToolkit*' -and $_.Name -notlike '*Setup*' -and $_.Name -notlike '*uninstaller*') } | Select-Object -First 1;" ^
  "if ($exe) {" ^
  "  $WshShell = New-Object -ComObject WScript.Shell;" ^
  "  $Shortcut = $WshShell.CreateShortcut('%~dp0TigoSecToolkit.lnk');" ^
  "  $Shortcut.TargetPath = $exe.FullName;" ^
  "  $Shortcut.WorkingDirectory = '%~dp0core\gui\release';" ^
  "  $Shortcut.Save();" ^
  "  Write-Host '  ✅ Atalho [TigoSecToolkit.lnk] criado com sucesso na raiz!' -ForegroundColor Green;" ^
  "} else {" ^
  "  Write-Host '  ⚠️ Executavel nao encontrado em release para criar o atalho.' -ForegroundColor Yellow;" ^
  "}"

echo.
echo ===================================================
echo   ✅ Concluido! Executavel gerado na pasta:
echo   core/gui/release/
echo ===================================================
pause
