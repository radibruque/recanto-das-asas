. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-RecantoWindows
$config = Get-RecantoConfig
if ([string]::IsNullOrWhiteSpace($config.url)) { throw 'Execute primeiro 03-Conectar-Tailscale.cmd.' }
Write-Host 'Preencha estes dados na tela Sincronizacao do Windows e do Android:'
Write-Host ('Endereco HTTPS: ' + $config.url)
Write-Host ('Identificador da base: ' + $config.workspaceId)
Write-Host 'Use a mesma senha do cofre nos dois aparelhos. Ela e diferente da chave de acesso abaixo.'
Write-Host 'A chave de acesso sera mostrada somente nesta janela. Nao a envie em conversas ou capturas de tela.'
$answer = Read-Host 'Digite MOSTRAR para revelar a chave de acesso'
if ($answer -ceq 'MOSTRAR') {
    $token = Get-RecantoToken
    Write-Host ('Chave de acesso / token: ' + $token)
    $token = $null
} else { Write-Host 'Chave mantida oculta.' }
