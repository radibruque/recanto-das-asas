Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$source = Join-Path (Split-Path $PSScriptRoot -Parent) 'sync-server/windows'
. (Join-Path $source 'Common.ps1')
$checks = 0
function Assert-Check([bool] $Condition, [string] $Message) {
    if (-not $Condition) { throw $Message }
    $script:checks++
}
function Assert-Rejected([scriptblock] $Action, [string] $Message) {
    $rejected = $false
    try { & $Action } catch { $rejected = $true }
    Assert-Check $rejected $Message
}

foreach ($file in Get-ChildItem -LiteralPath $source -Filter '*.ps1') {
    $tokens = $null
    $parseErrors = $null
    [Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref] $tokens, [ref] $parseErrors) | Out-Null
    Assert-Check ($parseErrors.Count -eq 0) ('Syntax error: ' + $file.Name)
}

$directory = Join-Path ([IO.Path]::GetTempPath()) ('recanto-launcher-test-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $directory | Out-Null
try {
    $dataFile = Join-Path $directory 'principal.json'
    [IO.File]::WriteAllText($dataFile, 'synthetic-ciphertext-preserved')
    $lockPath = Join-Path $directory 'server.lock'
    $localHost = [Net.Dns]::GetHostName()
    Write-RecantoJson $lockPath @{ kind = 'recanto-sync-lock-v1'; host = $localHost; pid = $PID }
    Assert-Rejected { Remove-RecantoStaleLock $directory } 'An active PID must preserve its lock.'
    Assert-Check (Test-Path -LiteralPath $lockPath) 'Active lock was removed.'

    Write-RecantoJson $lockPath @{ kind = 'recanto-sync-lock-v1'; host = 'different-synthetic-host'; pid = [int]::MaxValue }
    Assert-Rejected { Remove-RecantoStaleLock $directory } 'A foreign host must preserve its lock.'
    Assert-Check (Test-Path -LiteralPath $lockPath) 'Foreign lock was removed.'

    [IO.File]::WriteAllText($lockPath, '{broken-json')
    Assert-Rejected { Remove-RecantoStaleLock $directory } 'A corrupt lock must be preserved.'
    Assert-Check ((Get-Content -LiteralPath $lockPath -Raw) -eq '{broken-json') 'Corrupt lock was changed.'

    Write-RecantoJson $lockPath @{ kind = 'recanto-sync-lock-v1'; host = $localHost; pid = $true }
    Assert-Rejected { Remove-RecantoStaleLock $directory } 'A non-numeric PID must be rejected.'

    Write-RecantoJson $lockPath @{ kind = 'recanto-sync-lock-v1'; host = $localHost; pid = [int]::MaxValue }
    Remove-RecantoStaleLock $directory
    Assert-Check (-not (Test-Path -LiteralPath $lockPath)) 'An absent local PID must allow recovery.'
    Assert-Check ((Get-Content -LiteralPath $dataFile -Raw) -eq 'synthetic-ciphertext-preserved') 'Recovery changed workspace data.'

    $json = Join-Path $directory 'atomic.json'
    Write-RecantoJson $json @{ revision = 1 }
    Write-RecantoJson $json @{ revision = 2 }
    Assert-Check ((Get-Content -LiteralPath $json -Raw | ConvertFrom-Json).revision -eq 2) 'Atomic replacement failed.'
    Assert-Check (@(Get-ChildItem -LiteralPath $directory -Filter '*.tmp').Count -eq 0) 'Temporary JSON files remained.'

    $leasePath = Join-Path $directory 'lease'
    $lease = New-Object IO.FileStream($leasePath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    try {
        Assert-Rejected { $second = New-Object IO.FileStream($leasePath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None); $second.Dispose() } 'Two supervisors must not own the same lease.'
    } finally { $lease.Dispose() }
    $newLease = New-Object IO.FileStream($leasePath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $newLease.Dispose()
    Assert-Check $true 'The OS lease must be reusable after release.'
} finally { Remove-Item -LiteralPath $directory -Recurse -Force }

$dns = 'synthetic-desktop.synthetic.ts.net'
$empty = '{}' | ConvertFrom-Json
Assert-Check (-not (Test-RecantoServeOwns443 $empty $dns)) 'An empty status must not prove a proxy.'
Assert-Check (-not (Test-RecantoServeUnsafe443 $empty)) 'An empty status must not be mistaken for Funnel.'
$own = ('{"TCP":{"443":{"HTTPS":true}},"Web":{"' + $dns + ':443":{"Handlers":{"/":{"Proxy":"http://127.0.0.1:8788"}}}}}') | ConvertFrom-Json
Assert-Check (Test-RecantoServeOwns443 $own $dns) 'The exact private proxy must be recognized.'
Assert-Check (-not (Test-RecantoServeUnsafe443 $own)) 'The private proxy was rejected.'
$other = '{"TCP":{"443":{"HTTPS":true}},"Web":{"other.synthetic.ts.net:443":{"Handlers":{"/":{"Proxy":"http://127.0.0.1:9999"}}}}}' | ConvertFrom-Json
Assert-Check (-not (Test-RecantoServeOwns443 $other $dns)) 'An unrelated proxy must not be overwritten.'
$funnel = ('{"TCP":{"443":{"HTTPS":true}},"AllowFunnel":{"' + $dns + ':443":true}}') | ConvertFrom-Json
Assert-Check (Test-RecantoServeUnsafe443 $funnel) 'A public Funnel must be refused.'
$foreground = '{"Foreground":{"session":{"TCP":{"443":{"HTTPS":true}}}}}' | ConvertFrom-Json
Assert-Check (Test-RecantoServeUnsafe443 $foreground) 'A temporary foreground proxy must be refused.'
$otherPort = '{"Foreground":{"session":{"TCP":{"8443":{"HTTPS":true}},"AllowFunnel":{"other.synthetic.ts.net:8443":true}}}}' | ConvertFrom-Json
Assert-Check (-not (Test-RecantoServeUnsafe443 $otherPort)) 'Unrelated ports must remain untouched.'

Write-Output ("PowerShell: $checks checks passed. Native Windows DPAPI, Startup and Tailscale remain device checks.")
