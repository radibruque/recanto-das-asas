$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$partes = @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'Windows.parte*' | Sort-Object Name)
if ($partes.Count -ne 3) { throw 'Faltam partes. Extraia todo o ZIP antes de executar.' }
$destino = Join-Path $PSScriptRoot 'Recanto-das-Asas-0.2.0-x64-Setup.exe'
Write-Host 'Preparando e verificando o instalador Windows...'
$saida = [System.IO.File]::Create($destino)
try { foreach ($parte in $partes) { $entrada = [System.IO.File]::OpenRead($parte.FullName); try { $entrada.CopyTo($saida) } finally { $entrada.Dispose() } } } finally { $saida.Dispose() }
if ((Get-FileHash -LiteralPath $destino -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'b9f17799866af5b2d6d246d682e4d5ff033837c4568b11997415428fb3678f9b') { Remove-Item -LiteralPath $destino; throw 'Instalador danificado. Baixe novamente.' }
Write-Host 'Instalador verificado. Faca backup, feche o aplicativo e execute Recanto-das-Asas-0.2.0-x64-Setup.exe. Nao desinstale a versao atual.'
