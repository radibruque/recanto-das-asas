. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-RecantoWindows

$root = Get-RecantoRoot
$program = Join-Path $root 'program'
$data = Join-Path $root 'data'
$bundle = Split-Path $PSScriptRoot -Parent
$manifestPath = Join-Path $bundle 'bundle-manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'Use o ZIP completo do servidor, extraido preservando as pastas.' }
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
foreach ($item in $manifest.files) {
    if ($item.path -match '(^[\\/]|\.\.|:)' -or $item.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'Manifesto invalido.' }
    $file = Join-Path $bundle $item.path
    if (-not (Test-Path -LiteralPath $file) -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256) {
        throw 'Arquivo ausente ou alterado. Baixe e extraia novamente o pacote.'
    }
}

Set-RecantoPrivateDirectory $root
Set-RecantoPrivateDirectory $data
Set-RecantoPrivateDirectory $program
$lease = $null
try {
    $lease = New-Object IO.FileStream((Join-Path $root 'supervisor.lease'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
} catch { throw 'O servidor esta em execucao. Use 05-Parar.cmd e aguarde antes de instalar novamente.' }
try {
    Set-RecantoPrivateDirectory (Join-Path $program 'windows')
    foreach ($item in $manifest.files) {
        $source = Join-Path $bundle $item.path
        $destination = Join-Path $program $item.path
        $parent = Split-Path $destination -Parent
        if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
        if ([IO.Path]::GetFullPath($source) -ne [IO.Path]::GetFullPath($destination)) {
            Copy-Item -LiteralPath $source -Destination $destination -Force
        }
    }
    if ([IO.Path]::GetFullPath($manifestPath) -ne [IO.Path]::GetFullPath((Join-Path $program 'bundle-manifest.json'))) {
        Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $program 'bundle-manifest.json') -Force
    }
    $tokenPath = Join-Path $root 'token.dpapi'
    $configPath = Join-Path $root 'config.json'
    if (-not (Test-Path -LiteralPath $tokenPath)) {
        if ((Test-Path -LiteralPath $configPath) -or @(Get-ChildItem -LiteralPath $data -Filter '*.json').Count -gt 0) {
            throw 'A chave esta ausente em uma instalacao existente. Preserve os dados e solicite recuperacao; nenhuma nova chave foi criada.'
        }
        $bytes = New-Object byte[] 32
        $random = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $random.GetBytes($bytes) } finally { $random.Dispose() }
        $token = [Convert]::ToBase64String($bytes)
        $protected = ConvertFrom-SecureString (ConvertTo-SecureString $token -AsPlainText -Force)
        [IO.File]::WriteAllText($tokenPath, $protected, [Text.Encoding]::ASCII)
        $token = $null
        [Array]::Clear($bytes, 0, $bytes.Length)
    }
    if (-not (Test-Path -LiteralPath $configPath)) {
        Write-RecantoJson $configPath ([ordered] @{ version = 1; workspaceId = 'principal'; url = ''; installedAt = [DateTime]::UtcNow.ToString('o') })
    }
    # Confirm that the DPAPI key belongs to this Windows account before startup.
    $token = Get-RecantoToken
    $token = $null
    Get-RecantoConfig | Out-Null
    $shell = New-Object -ComObject WScript.Shell
    $startup = Get-RecantoStartupPath
    if (Test-Path -LiteralPath $startup) {
        $existing = $shell.CreateShortcut($startup)
        if ($existing.Arguments -ne (Get-RecantoSupervisorArguments) -or $existing.TargetPath -ne (Join-Path $PSHOME 'powershell.exe')) { throw 'Ja existe outro atalho com esse nome. Nao foi substituido.' }
    }
    $shortcut = $shell.CreateShortcut($startup)
    $shortcut.TargetPath = Join-Path $PSHOME 'powershell.exe'
    $shortcut.Arguments = Get-RecantoSupervisorArguments
    $shortcut.WorkingDirectory = $program
    $shortcut.Description = 'Servidor privado do Recanto das Asas. Inicia apos entrar nesta conta do Windows.'
    $shortcut.Save()
} finally { if ($null -ne $lease) { $lease.Dispose() } }

Start-RecantoSupervisor
$ready = $false
for ($attempt = 0; $attempt -lt 15; $attempt++) {
    if (Test-RecantoLocal) { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) { throw ('O servidor nao respondeu. Consulte o arquivo ' + (Join-Path $root 'status.log') + '; nao apague os dados.') }
Write-Host 'Servidor instalado e respondendo no proprio computador.'
Write-Host 'Inicio automatico: depois de entrar nesta mesma conta do Windows.'
Write-Host 'Proxima etapa: 03-Conectar-Tailscale.cmd, apos instalar e conectar o Tailscale.'
