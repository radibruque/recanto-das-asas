@echo off
setlocal
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0windows\Connect-Tailscale.ps1"
set "recanto_exit_code=%ERRORLEVEL%"
if not "%recanto_exit_code%"=="0" echo A operacao falhou. Leia a mensagem acima; preserve seus dados.
pause
exit /b %recanto_exit_code%
