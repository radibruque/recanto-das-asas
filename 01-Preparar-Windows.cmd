@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Preparar-Windows.ps1"
if errorlevel 1 echo Falha: leia a mensagem acima.
pause
