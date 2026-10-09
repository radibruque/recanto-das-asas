#!/usr/bin/env python3
"""Package existing installers, hashes and committed source for private ZIP delivery."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / 'aplicativo'
VERSION = json.loads((APP / 'package.json').read_text())['version']
PART_SIZE = 48 * 1024 * 1024


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(block)
    return result.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--source-ref', default='HEAD')
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        raise SystemExit('Use uma pasta de saída vazia para evitar arquivos de versões anteriores.')
    apk = APP / 'release/android' / f'Recanto-das-Asas-{VERSION}-debug.apk'
    installer = APP / 'release/windows' / f'Recanto-das-Asas-{VERSION}-x64-Setup.exe'
    for path, magic in [(apk, b'PK'), (installer, b'MZ')]:
        with path.open('rb') as stream:
            if stream.read(2) != magic:
                raise SystemExit(f'Artefato inválido: {path.name}')
    installer_hash = digest(installer)
    shutil.copy2(apk, output / apk.name)
    parts = []
    with installer.open('rb') as stream:
        while block := stream.read(PART_SIZE):
            part = output / f'Windows.parte{len(parts)+1:02d}'
            part.write_bytes(block)
            parts.append(part)
    ps1 = f'''$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$partes = @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'Windows.parte*' | Sort-Object Name)
if ($partes.Count -ne {len(parts)}) {{ throw 'Faltam partes. Extraia todo o ZIP antes de executar.' }}
$destino = Join-Path $PSScriptRoot '{installer.name}'
Write-Host 'Preparando e verificando o instalador Windows...'
$saida = [System.IO.File]::Create($destino)
try {{ foreach ($parte in $partes) {{ $entrada = [System.IO.File]::OpenRead($parte.FullName); try {{ $entrada.CopyTo($saida) }} finally {{ $entrada.Dispose() }} }} }} finally {{ $saida.Dispose() }}
if ((Get-FileHash -LiteralPath $destino -Algorithm SHA256).Hash.ToLowerInvariant() -ne '{installer_hash}') {{ Remove-Item -LiteralPath $destino; throw 'Instalador danificado. Baixe novamente.' }}
Write-Host 'Instalador verificado. Faca backup, feche o aplicativo e execute {installer.name}. Nao desinstale a versao atual.'
'''
    (output / 'Preparar-Windows.ps1').write_bytes(b'\xef\xbb\xbf' + ps1.replace('\n', '\r\n').encode())
    (output / '01-Preparar-Windows.cmd').write_bytes(b'@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Preparar-Windows.ps1"\r\nif errorlevel 1 echo Falha: leia a mensagem acima.\r\npause\r\n')
    for path in [apk, installer]:
        (output / (path.name + '.sha256')).write_text(f'{digest(path)}  {path.name}\n')
    shutil.copy2(ROOT / 'docs' / f'ATUALIZACAO_{VERSION}.md', output / 'LEIA-PRIMEIRO.md')
    source = output / f'Codigo-fonte-{VERSION}.zip'
    subprocess.run(['git', 'archive', '--format=zip', f'--prefix=recanto-das-asas-{VERSION}/', f'--output={source}', args.source_ref], cwd=ROOT, check=True)
    files = sorted(path for path in output.iterdir() if path.is_file())
    if any(path.stat().st_size >= 100 * 1024 * 1024 for path in files):
        raise SystemExit('Um arquivo ultrapassa o limite de 100 MiB por arquivo do GitHub.')
    (output / 'SHA256SUMS.txt').write_text(''.join(f'{digest(path)}  {path.name}\n' for path in files))
    print(json.dumps({'version': VERSION, 'parts': len(parts), 'installerSha256': installer_hash, 'files': len(files) + 1}))


if __name__ == '__main__':
    main()
