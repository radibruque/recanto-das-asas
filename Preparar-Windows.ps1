$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$partes = @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'Windows.parte*' | Sort-Object Name)
if ($partes.Count -ne 3) { throw 'Faltam partes. Extraia todo o ZIP antes de executar.' }
$destino = Join-Path $PSScriptRoot 'Recanto-das-Asas-0.1.1-x64-Setup.exe'
Write-Host 'Preparando e verificando o instalador Windows...'
$saida = [System.IO.File]::Create($destino)
try { foreach ($parte in $partes) { $entrada = [System.IO.File]::OpenRead($parte.FullName); try { $entrada.CopyTo($saida) } finally { $entrada.Dispose() } } } finally { $saida.Dispose() }
if ((Get-FileHash -LiteralPath $destino -Algorithm SHA256).Hash.ToLowerInvariant() -ne '6cd148922cb61e31e8052a4f56e43c3432dd723562470fc088e3a8591f3ec5bb') { throw 'Instalador danificado. Baixe novamente.' }
Write-Host 'Instalador verificado. Faca backup, feche o aplicativo e execute Recanto-das-Asas-0.1.1-x64-Setup.exe. Nao desinstale a versao atual.'
