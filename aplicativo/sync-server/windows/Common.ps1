Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function Assert-RecantoWindows {
    if ($env:OS -ne 'Windows_NT') { throw 'Este pacote deve ser executado no Windows 10/11 de 64 bits.' }
    if (-not [Environment]::Is64BitOperatingSystem) { throw 'Este pacote requer Windows de 64 bits.' }
}

function Get-RecantoRoot {
    if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { throw 'Pasta local do usuario indisponivel.' }
    return (Join-Path $env:LOCALAPPDATA 'RecantoDasAsasSync')
}

function Set-RecantoPrivateDirectory([string] $Path) {
    if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path | Out-Null }
    $item = Get-Item -LiteralPath $Path
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'A pasta privada nao pode ser um link ou uma juncao.' }
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $system = New-Object Security.Principal.SecurityIdentifier('S-1-5-18')
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetOwner($sid)
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($identity in @($sid, $system)) {
        $rule = New-Object Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
}

function Write-RecantoJson([string] $Path, $Value) {
    $temporary = $Path + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
    try {
        [IO.File]::WriteAllText($temporary, ($Value | ConvertTo-Json -Depth 12), (New-Object Text.UTF8Encoding($false)))
        if (Test-Path -LiteralPath $Path) {
            # PowerShell coerces $null to an empty string for this .NET overload.
            # A unique backup name works on both Windows PowerShell and Core.
            $previous = $temporary + '.previous'
            [IO.File]::Replace($temporary, $Path, $previous)
            Remove-Item -LiteralPath $previous
        }
        else { [IO.File]::Move($temporary, $Path) }
    } finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary }
    }
}

function Get-RecantoConfig {
    $root = Get-RecantoRoot
    $path = Join-Path $root 'config.json'
    if (-not (Test-Path -LiteralPath $path)) { throw 'Execute primeiro 01-Instalar.cmd.' }
    $config = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    if ($config.version -ne 1 -or $config.workspaceId -notmatch '^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$') { throw 'Configuracao invalida. Preserve os dados e solicite suporte.' }
    return $config
}

function Get-RecantoToken {
    $path = Join-Path (Get-RecantoRoot) 'token.dpapi'
    if (-not (Test-Path -LiteralPath $path)) { throw 'Chave de acesso ausente. Execute 01-Instalar.cmd sem apagar a pasta de dados.' }
    $secure = ConvertTo-SecureString (Get-Content -LiteralPath $path -Raw).Trim()
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        if ($token.Length -lt 32 -or $token.Contains("`n") -or $token.Contains("`r")) { throw 'Chave de acesso invalida.' }
        return $token
    } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Get-RecantoStartupPath {
    return (Join-Path ([Environment]::GetFolderPath('Startup')) 'Recanto das Asas - Servidor local.lnk')
}

function Get-RecantoSupervisorArguments {
    $script = Join-Path (Get-RecantoRoot) 'program\windows\Supervisor.ps1'
    return ('-NoProfile -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "' + $script + '"')
}

function Start-RecantoSupervisor {
    $root = Get-RecantoRoot
    if (Test-Path -LiteralPath (Join-Path $root 'stop.request')) { Remove-Item -LiteralPath (Join-Path $root 'stop.request') }
    Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList (Get-RecantoSupervisorArguments) -WindowStyle Hidden | Out-Null
}

function Test-RecantoLocal {
    $config = Get-RecantoConfig
    $token = Get-RecantoToken
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Method Head -Uri ('http://127.0.0.1:8788/v1/workspace/' + $config.workspaceId) -Headers @{ Authorization = ('Bearer ' + $token); 'X-Recanto-Schema-Version' = '3' } -TimeoutSec 3
        return ($response.StatusCode -eq 200 -and $response.Headers['X-Recanto-Schema-Gate'] -eq '1')
    } catch { return $false }
    finally { $token = $null }
}

function Remove-RecantoStaleLock([string] $DataDir) {
    $path = Join-Path $DataDir 'server.lock'
    if (-not (Test-Path -LiteralPath $path)) { return }
    if ((Get-Item -LiteralPath $path).Length -gt 4096) { throw 'Trava inesperada. Nao sera apagada automaticamente.' }
    $before = Get-Content -LiteralPath $path -Raw
    try { $owner = $before | ConvertFrom-Json }
    catch { throw 'Trava invalida. Preserve os arquivos de dados e solicite suporte.' }
    $localHost = [Net.Dns]::GetHostName()
    if ($owner.kind -ne 'recanto-sync-lock-v1' -or $owner.host -ne $localHost -or ($owner.pid -isnot [int] -and $owner.pid -isnot [long]) -or $owner.pid -lt 1 -or $owner.pid -gt [int]::MaxValue) {
        throw 'Trava de origem desconhecida. Nao sera apagada automaticamente.'
    }
    try {
        $existing = [Diagnostics.Process]::GetProcessById([int] $owner.pid)
        $existing.Dispose()
        throw 'Ha um processo com o PID da trava. Nao sera apagada automaticamente.'
    } catch [ArgumentException] {
        # Only an absent PID on this host permits recovery. Permission errors,
        # corrupt locks and reused PIDs are intentionally left for inspection.
    }
    if ((Get-Content -LiteralPath $path -Raw) -cne $before) { throw 'A trava mudou durante a verificacao. Tente novamente.' }
    Remove-Item -LiteralPath $path
}

function Find-RecantoTailscale {
    $command = Get-Command tailscale.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $path = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
    if (Test-Path -LiteralPath $path) { return $path }
    throw 'Instale e conecte o Tailscale no Windows antes desta etapa.'
}

function Get-RecantoProperty($Object, [string] $Name) {
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

function Test-RecantoServeOwns443($Status, [string] $DnsName) {
    $tcp = Get-RecantoProperty (Get-RecantoProperty $Status 'TCP') '443'
    $web = Get-RecantoProperty (Get-RecantoProperty $Status 'Web') ($DnsName + ':443')
    $handler = Get-RecantoProperty (Get-RecantoProperty $web 'Handlers') '/'
    $proxy = Get-RecantoProperty $handler 'Proxy'
    $funnel = Get-RecantoProperty (Get-RecantoProperty $Status 'AllowFunnel') ($DnsName + ':443')
    return ($null -ne $tcp -and (Get-RecantoProperty $tcp 'HTTPS') -eq $true -and $proxy -eq 'http://127.0.0.1:8788' -and $funnel -ne $true)
}

function Test-RecantoServeUnsafe443($Status) {
    $public = Get-RecantoProperty $Status 'AllowFunnel'
    if ($null -ne $public) {
        foreach ($property in $public.PSObject.Properties) {
            if ($property.Name.EndsWith(':443') -and $property.Value -eq $true) { return $true }
        }
    }
    $foreground = Get-RecantoProperty $Status 'Foreground'
    if ($null -ne $foreground) {
        foreach ($session in $foreground.PSObject.Properties) {
            if ($null -ne (Get-RecantoProperty (Get-RecantoProperty $session.Value 'TCP') '443')) { return $true }
            if (Test-RecantoServeUnsafe443 $session.Value) { return $true }
        }
    }
    return $false
}
