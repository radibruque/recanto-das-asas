$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$partes = @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'Windows.parte*' | Sort-Object Name)
if ($partes.Count -ne 3) { throw 'Faltam partes. Extraia todo o ZIP antes de executar.' }
$destino = Join-Path $PSScriptRoot 'Recanto-das-Asas-0.2.1-x64-Setup.exe'
Write-Host 'Preparando e verificando o instalador Windows...'
$saida = [System.IO.File]::Create($destino)
try { foreach ($parte in $partes) { $entrada = [System.IO.File]::OpenRead($parte.FullName); try { $entrada.CopyTo($saida) } finally { $entrada.Dispose() } } } finally { $saida.Dispose() }
if ((Get-FileHash -LiteralPath $destino -Algorithm SHA256).Hash.ToLowerInvariant() -ne '838e258be84fb14793800801bacfa73ceff02b26c6c4fd6fa082c167593e216c') { Remove-Item -LiteralPath $destino; throw 'Instalador danificado. Baixe novamente.' }
Write-Host 'Instalador verificado. Faça backup, feche o aplicativo e execute Recanto-das-Asas-0.2.1-x64-Setup.exe. Não desinstale a versão atual.'
