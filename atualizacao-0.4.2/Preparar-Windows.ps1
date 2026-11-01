$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$partes = @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'Windows.parte*' | Sort-Object Name)
if ($partes.Count -ne 6) { throw 'Faltam partes. Extraia todo o ZIP antes de executar.' }
$destino = Join-Path $PSScriptRoot 'Recanto-das-Asas-0.4.2-x64-Setup.exe'
Write-Host 'Preparando e verificando o instalador Windows...'
$saida = [System.IO.File]::Create($destino)
try { foreach ($parte in $partes) { $entrada = [System.IO.File]::OpenRead($parte.FullName); try { $entrada.CopyTo($saida) } finally { $entrada.Dispose() } } } finally { $saida.Dispose() }
if ((Get-FileHash -LiteralPath $destino -Algorithm SHA256).Hash.ToLowerInvariant() -ne '8e1000c168a700c48f31349823ef8c262779741cbae7640f7ccd26d8fefe3d8a') { Remove-Item -LiteralPath $destino; throw 'Instalador danificado. Baixe novamente todas as partes.' }
Write-Host 'Instalador verificado. Feche o aplicativo e execute Recanto-das-Asas-0.4.2-x64-Setup.exe. Nao desinstale a versao atual.'
