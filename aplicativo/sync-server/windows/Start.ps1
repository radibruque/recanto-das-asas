. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-RecantoWindows
Get-RecantoConfig | Out-Null
Start-RecantoSupervisor
$ready = $false
for ($attempt = 0; $attempt -lt 15; $attempt++) {
    if (Test-RecantoLocal) { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) { throw 'O servidor nao respondeu. Consulte status.log na pasta privada; preserve os dados.' }
Write-Host 'Servidor local respondendo. Mantenha o computador ligado e conectado.'
