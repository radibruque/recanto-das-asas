. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-RecantoWindows
$root = Get-RecantoRoot
$program = Split-Path $PSScriptRoot -Parent
$data = Join-Path $root 'data'
$stopPath = Join-Path $root 'stop.request'
$logPath = Join-Path $root 'status.log'
$lease = $null
$child = $null

function Write-RecantoStatus([string] $Message) {
    if ((Test-Path -LiteralPath $logPath) -and (Get-Item -LiteralPath $logPath).Length -gt 262144) {
        Move-Item -LiteralPath $logPath -Destination ($logPath + '.previous') -Force
    }
    Add-Content -LiteralPath $logPath -Value ([DateTime]::UtcNow.ToString('o') + ' ' + $Message) -Encoding UTF8
}

try {
    try {
        # FileShare.None is an OS lease: Windows releases it even after a crash.
        $lease = New-Object IO.FileStream((Join-Path $root 'supervisor.lease'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    } catch { exit 0 }
    # A stop belongs to the previous run. A new login or explicit start resumes.
    if (Test-Path -LiteralPath $stopPath) { Remove-Item -LiteralPath $stopPath }
    $config = Get-RecantoConfig
    $delay = 3
    while (-not (Test-Path -LiteralPath $stopPath)) {
        try {
            Remove-RecantoStaleLock $data
            $info = New-Object Diagnostics.ProcessStartInfo
            $info.FileName = Join-Path $program 'node.exe'
            $info.Arguments = '"' + (Join-Path $program 'server.mjs') + '"'
            $info.WorkingDirectory = $program
            $info.UseShellExecute = $false
            $info.CreateNoWindow = $true
            $info.RedirectStandardInput = $true
            $info.RedirectStandardOutput = $true
            $info.RedirectStandardError = $true
            $info.EnvironmentVariables['SYNC_HOST'] = '127.0.0.1'
            $info.EnvironmentVariables['SYNC_PORT'] = '8788'
            $info.EnvironmentVariables['SYNC_DATA_DIR'] = $data
            $info.EnvironmentVariables['SYNC_ALLOWED_ORIGINS'] = 'app://recanto,https://localhost'
            $info.EnvironmentVariables['SYNC_CONTROL_STDIN'] = '1'
            $info.EnvironmentVariables['SYNC_TOKEN'] = Get-RecantoToken
            $child = New-Object Diagnostics.Process
            $child.StartInfo = $info
            $child.Start() | Out-Null
            $info.EnvironmentVariables.Remove('SYNC_TOKEN')
            $output = $child.StandardOutput.ReadToEndAsync()
            $errors = $child.StandardError.ReadToEndAsync()
            Write-RecantoStatus 'Processo iniciado; aguardando verificacao pelo cliente.'
            $started = [DateTime]::UtcNow
            while (-not $child.WaitForExit(1000)) {
                if (Test-Path -LiteralPath $stopPath) {
                    try { $child.StandardInput.WriteLine('recanto-sync-stop-v1'); $child.StandardInput.Flush() } catch { }
                    if (-not $child.WaitForExit(75000)) { $child.Kill(); $child.WaitForExit() }
                    break
                }
            }
            Write-RecantoStatus ('Processo encerrado; codigo ' + $child.ExitCode + '.')
            $child.Dispose()
            $child = $null
            if (Test-Path -LiteralPath $stopPath) { break }
            if (([DateTime]::UtcNow - $started).TotalSeconds -gt 60) { $delay = 3 }
            else { $delay = [Math]::Min(30, $delay * 2) }
        } catch {
            # No token, vault content or raw exception is written to diagnostics.
            Write-RecantoStatus 'Falha ao iniciar. Verifique chave, porta e trava; dados preservados.'
            if ($null -ne $child) {
                try { if (-not $child.HasExited) { $child.StandardInput.Close(); if (-not $child.WaitForExit(75000)) { $child.Kill() } } } catch { }
                $child.Dispose()
                $child = $null
            }
            $delay = 30
        }
        for ($second = 0; $second -lt $delay; $second++) {
            if (Test-Path -LiteralPath $stopPath) { break }
            Start-Sleep -Seconds 1
        }
    }
    Write-RecantoStatus 'Servidor parado por solicitacao. Inicio automatico permanece configurado.'
} finally {
    if ($null -ne $child) {
        try { $child.StandardInput.Close(); if (-not $child.WaitForExit(75000)) { $child.Kill() } } catch { }
        $child.Dispose()
    }
    if ($null -ne $lease) { $lease.Dispose() }
}
