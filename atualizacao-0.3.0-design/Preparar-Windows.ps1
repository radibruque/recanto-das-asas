$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$partes = @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'Windows.parte*' | Sort-Object Name)
if ($partes.Count -ne 6) { throw 'Faltam partes. Extraia todo o ZIP antes de executar.' }
$destino = Join-Path $PSScriptRoot 'Recanto-das-Asas-0.3.0-x64-Setup.exe'
Write-Host 'Preparando e verificando o instalador Windows (novo design)...'
$saida = [System.IO.File]::Create($destino)
try { foreach ($parte in $partes) { $entrada = [System.IO.File]::OpenRead($parte.FullName); try { $entrada.CopyTo($saida) } finally { $entrada.Dispose() } } } finally { $saida.Dispose() }
if ((Get-FileHash -LiteralPath $destino -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'c56f6b664010d0952ba160c9730b3145aec134689366e3960deaff26a4fbeef2') { Remove-Item -LiteralPath $destino; throw 'Instalador danificado. Baixe novamente.' }
Write-Host 'Instalador verificado. Faca backup, feche o aplicativo e execute Recanto-das-Asas-0.3.0-x64-Setup.exe. Nao desinstale a versao atual.'
