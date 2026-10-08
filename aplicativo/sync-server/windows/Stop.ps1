. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-RecantoWindows
Get-RecantoConfig | Out-Null
$root = Get-RecantoRoot
[IO.File]::WriteAllText((Join-Path $root 'stop.request'), 'recanto-sync-stop-v1', [Text.Encoding]::ASCII)
$stopped = $false
for ($attempt = 0; $attempt -lt 90; $attempt++) {
    $lease = $null
    try {
        $lease = New-Object IO.FileStream((Join-Path $root 'supervisor.lease'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        $stopped = $true
    } catch { }
    finally { if ($null -ne $lease) { $lease.Dispose() } }
    if ($stopped) { break }
    Start-Sleep -Seconds 1
}
if (-not $stopped) { throw 'O servidor ainda esta encerrando. Nao apague travas nem arquivos de dados.' }
Write-Host 'Servidor parado. Os dados e a conexao Tailscale foram preservados.'
Write-Host 'Para voltar agora: 02-Iniciar.cmd. O inicio automatico continua instalado.'
