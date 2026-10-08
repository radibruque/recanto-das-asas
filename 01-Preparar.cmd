@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Preparar.ps1"
if errorlevel 1 echo Falha na preparacao. Leia a mensagem acima.
pause
