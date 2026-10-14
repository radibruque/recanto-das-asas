. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-RecantoWindows
$config = Get-RecantoConfig
if (-not (Test-RecantoLocal)) { throw 'Inicie o servidor com 02-Iniciar.cmd antes desta etapa.' }
$tailscale = Find-RecantoTailscale
$raw = & $tailscale status --json
if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel consultar o Tailscale. Abra o programa e conecte sua conta.' }
$status = $raw | ConvertFrom-Json
if ($status.BackendState -ne 'Running') { throw 'O Tailscale precisa estar conectado antes desta etapa.' }
$dnsName = $status.Self.DNSName.TrimEnd('.').ToLowerInvariant()
if ($dnsName -notmatch '^[a-z0-9][a-z0-9.-]+\.ts\.net$') { throw 'Ative MagicDNS no painel do Tailscale e tente novamente.' }
$rawServe = & $tailscale serve status --json
if ($LASTEXITCODE -ne 0) { throw 'Atualize o Tailscale: nao foi possivel consultar o estado de Serve.' }
$serve = $rawServe | ConvertFrom-Json
if (Test-RecantoServeUnsafe443 $serve) { throw 'A porta 443 tem configuracao publica Funnel ou uma sessao temporaria. Nada foi alterado.' }
$existing443 = Get-RecantoProperty (Get-RecantoProperty $serve 'TCP') '443'
if ($null -ne $existing443 -and -not (Test-RecantoServeOwns443 $serve $dnsName)) {
    throw 'A porta HTTPS 443 ja tem outra configuracao Serve/Funnel. Nada foi substituido; solicite ajuste antes de continuar.'
}
if ($null -eq $existing443) {
    Write-Host 'Esta etapa configura HTTPS privado dentro da sua rede Tailscale.'
    Write-Host 'Se aparecer um link de habilitacao de HTTPS, abra-o e habilite apenas Serve/certificados.'
    Write-Host 'Nao e necessario contratar hospedagem, habilitar Funnel ou abrir portas no roteador.'
    & $tailscale serve --bg --https=443 http://127.0.0.1:8788
    if ($LASTEXITCODE -ne 0) { throw 'HTTPS privado nao foi configurado. Verifique a habilitacao no painel do Tailscale.' }
}
$rawServe = & $tailscale serve status --json
if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel confirmar o proxy privado. O endereco nao foi salvo.' }
$verifiedServe = $rawServe | ConvertFrom-Json
if ((Test-RecantoServeUnsafe443 $verifiedServe) -or -not (Test-RecantoServeOwns443 $verifiedServe $dnsName)) {
    throw 'Nao foi possivel confirmar o proxy privado. O endereco nao foi salvo.'
}
$url = 'https://' + $dnsName
$token = Get-RecantoToken
# Windows PowerShell 5.1 may otherwise inherit obsolete .NET TLS defaults.
# This is limited to this process; certificate validation remains enabled.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try {
    $response = Invoke-WebRequest -UseBasicParsing -Method Head -Uri ($url + '/v1/workspace/' + $config.workspaceId) -Headers @{ Authorization = ('Bearer ' + $token); 'X-Recanto-Schema-Version' = '3' } -TimeoutSec 20
    if ($response.StatusCode -ne 200 -or $response.Headers['X-Recanto-Schema-Gate'] -ne '1') { throw 'Unexpected response' }
} catch { throw 'HTTPS nao respondeu com autenticacao valida. Confira certificados, DNS e acesso privado; os dados locais foram preservados.' }
finally { $token = $null }
$config.url = $url
Write-RecantoJson (Join-Path (Get-RecantoRoot) 'config.json') $config
Write-Host 'HTTPS privado configurado e respondendo neste desktop:'
Write-Host $url
Write-Host 'Use 04-Mostrar-Conexao.cmd para configurar os aplicativos. Teste tambem pelo Android fora do Wi-Fi.'
