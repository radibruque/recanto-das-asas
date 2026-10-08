. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-RecantoWindows
$path = Get-RecantoStartupPath
if (-not (Test-Path -LiteralPath $path)) { Write-Host 'Inicio automatico ja esta desativado.'; exit 0 }
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($path)
if ($shortcut.Arguments -ne (Get-RecantoSupervisorArguments) -or $shortcut.TargetPath -ne (Join-Path $PSHOME 'powershell.exe')) {
    throw 'O atalho nao corresponde a esta instalacao. Nada foi removido.'
}
Remove-Item -LiteralPath $path
Write-Host 'Inicio automatico desativado. Os dados foram preservados.'
Write-Host 'Use 05-Parar.cmd se tambem quiser encerrar o servidor agora.'
