$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$destino = Join-Path $PSScriptRoot 'Recanto-das-Asas-Instalacao-0.1.0.zip'
$partes = @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'pacote.parte*' | Sort-Object Name)
if ($partes.Count -ne 6) { throw 'Faltam partes. Extraia todo o ZIP baixado antes de executar.' }
Write-Host 'Preparando o pacote de instalacao...'
$saida = [System.IO.File]::Create($destino)
try {
 foreach ($parte in $partes) {
  $entrada = [System.IO.File]::OpenRead($parte.FullName)
  try { $entrada.CopyTo($saida) } finally { $entrada.Dispose() }
 }
} finally { $saida.Dispose() }
$hash = (Get-FileHash -LiteralPath $destino -Algorithm SHA256).Hash.ToLowerInvariant()
if ($hash -ne '85825c10f0065d224c37dc3669246c822b1a97715962fc1105c1421dd06d31cc') { throw 'O arquivo esta incompleto ou danificado. Baixe novamente.' }
Expand-Archive -LiteralPath $destino -DestinationPath $PSScriptRoot -Force
Write-Host 'Pronto. Abra a pasta Recanto-das-Asas-Instalacao-0.1.0 e siga o Guia-Instalacao.pdf.'
Start-Process (Join-Path $PSScriptRoot 'Recanto-das-Asas-Instalacao-0.1.0')
