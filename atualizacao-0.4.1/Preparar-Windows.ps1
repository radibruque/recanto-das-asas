$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$partes = @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'Windows.parte*' | Sort-Object Name)
if ($partes.Count -ne 6) { throw 'Faltam partes. Extraia todo o ZIP antes de executar.' }
$destino = Join-Path $PSScriptRoot 'Recanto-das-Asas-0.4.1-x64-Setup.exe'
Write-Host 'Preparando e verificando o instalador Windows 0.4.1...'
$saida = [System.IO.File]::Create($destino)
try { foreach ($parte in $partes) { $entrada = [System.IO.File]::OpenRead($parte.FullName); try { $entrada.CopyTo($saida) } finally { $entrada.Dispose() } } } finally { $saida.Dispose() }
if ((Get-FileHash -LiteralPath $destino -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'a9a78552d6ef122917c2c75cc2dedad083849c86ccfb137b614c829ef753a46b') { Remove-Item -LiteralPath $destino; throw 'Instalador danificado. Baixe novamente.' }
Write-Host 'Instalador verificado. Faca backup, feche o aplicativo e execute Recanto-das-Asas-0.4.1-x64-Setup.exe. Nao desinstale a versao atual.'
