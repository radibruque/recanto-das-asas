#!/usr/bin/env python3
"""Create an installation bundle from existing verified artifacts; no rebuilds."""
import base64
import hashlib
import html
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tempfile
import unicodedata
from urllib.parse import urlsplit
import zipfile

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / 'aplicativo'
VERSION = '0.1.0'
OUTPUT = APP / 'release' / 'entrega'
PREFIX = f'Recanto-das-Asas-Instalacao-{VERSION}'


def digest(path):
    hasher = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            hasher.update(chunk)
    return hasher.hexdigest()


def slug(value):
    ascii_value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', ascii_value.lower()).strip('-')


def inline(value):
    pattern = re.compile(r'`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)')
    result, offset = [], 0
    for match in pattern.finditer(value):
        result.append(html.escape(value[offset:match.start()]))
        if match.group(1) is not None:
            result.append('<code>' + html.escape(match.group(1)) + '</code>')
        elif match.group(2) is not None:
            result.append('<strong>' + html.escape(match.group(2)) + '</strong>')
        else:
            href = match.group(4)
            if urlsplit(href).scheme not in ('', 'https', 'http'):
                raise ValueError('Unsupported guide link')
            result.append('<a href="' + html.escape(href, quote=True) + '">' + html.escape(match.group(3)) + '</a>')
        offset = match.end()
    result.append(html.escape(value[offset:]))
    return ''.join(result)


def markdown_body(markdown):
    lines = markdown.splitlines()
    result, paragraph = [], []
    list_kind = None
    table = []

    def flush_paragraph():
        if paragraph:
            result.append('<p>' + inline(' '.join(paragraph)) + '</p>')
            paragraph.clear()

    def close_list():
        nonlocal list_kind
        if list_kind:
            result.append('</' + list_kind + '>')
            list_kind = None

    def flush_table():
        if not table:
            return
        rows = [row.strip().strip('|').split('|') for row in table]
        header = rows[0]
        result.append('<div class="table-wrap"><table><thead><tr>' + ''.join('<th>' + inline(cell.strip()) + '</th>' for cell in header) + '</tr></thead><tbody>')
        for row in rows[2:]:
            result.append('<tr>' + ''.join('<td>' + inline(cell.strip()) + '</td>' for cell in row) + '</tr>')
        result.append('</tbody></table></div>')
        table.clear()

    for line in lines + ['']:
        if line.startswith('|'):
            flush_paragraph()
            close_list()
            table.append(line)
            continue
        flush_table()
        heading = re.match(r'^(#{1,3})\s+(.+)$', line)
        item = re.match(r'^(?:([-*])\s+|\d+\.\s+)(.+)$', line)
        if heading:
            flush_paragraph()
            close_list()
            level, title = len(heading.group(1)), heading.group(2)
            result.append(f'<h{level} id="{slug(title)}">{inline(title)}</h{level}>')
        elif item:
            flush_paragraph()
            kind = 'ul' if item.group(1) else 'ol'
            if list_kind != kind:
                close_list()
                result.append('<' + kind + '>')
                list_kind = kind
            result.append('<li>' + inline(item.group(2)) + '</li>')
        elif line.strip():
            close_list()
            paragraph.append(line.strip())
        else:
            flush_paragraph()
            close_list()
    return '\n'.join(result)


def make_html(markdown):
    font = base64.b64encode((APP / 'public/fonts/NotoSans.ttf').read_bytes()).decode()
    logo = base64.b64encode((APP / 'public/artes/01_Principal/Logo_Colorida_Transparente_1254px.png').read_bytes()).decode()
    headings = re.findall(r'^##\s+(.+)$', markdown, re.MULTILINE)
    nav = ''.join('<a href="#' + slug(title) + '">' + html.escape(title) + '</a>' for title in headings)
    license_text = (APP / 'public/fonts/OFL.txt').read_text('utf8').replace('-->', '-- >')
    return '<!doctype html>\n<!-- Embedded Noto Sans font license:\n' + license_text + '\n-->\n' + '''<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recanto das Asas — Instalação completa</title>
<style>
@font-face{font-family:Noto;src:url(data:font/ttf;base64,''' + font + ''') format('truetype');font-weight:100 900;font-style:normal;font-display:block}
*{box-sizing:border-box}body{margin:0;background:#edf4f7;color:#183342;font-family:Noto,Arial,sans-serif;font-size:15px;line-height:1.65}main{max-width:980px;margin:32px auto;padding:36px 46px;background:white;border:1px solid #d9e5ec;border-radius:18px}header{display:flex;align-items:center;gap:24px;padding-bottom:20px;border-bottom:2px solid #d9e5ec}header img{width:156px;height:134px;object-fit:contain}.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#087d95}h1{font-size:30px;line-height:1.25;letter-spacing:-.035em;margin:26px 0 18px}h2{font-size:21px;line-height:1.35;color:#006e89;border-top:1px solid #d9e5ec;padding-top:25px;margin:35px 0 14px;break-after:avoid;scroll-margin-top:12px}h3{font-size:17px;break-after:avoid}p{margin:12px 0}li{padding-left:5px;margin:8px 0;break-inside:avoid}ol,ul{padding-left:25px}a{color:#007a98;text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}code{font-family:Consolas,monospace;font-size:.87em;background:#edf4f7;border-radius:4px;padding:2px 5px;overflow-wrap:anywhere}strong{font-weight:700}nav{display:grid;grid-template-columns:1fr 1fr;gap:7px 20px;padding:18px;background:#f1f7fa;border-radius:10px;margin:22px 0}nav a{font-size:12px;text-decoration:none}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:12px;margin:18px 0}th,td{border:1px solid #d9e5ec;padding:10px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eaf3f7;color:#07566d}tr{break-inside:avoid}footer{border-top:1px solid #d9e5ec;margin-top:32px;padding-top:15px;font-size:12px;color:#516f80}@media(max-width:650px){main{margin:0;border:0;border-radius:0;padding:24px 20px}header{gap:14px}header img{width:110px;height:95px}h1{font-size:25px}nav{grid-template-columns:1fr}table{font-size:11px}th,td{padding:7px}}@page{size:A4;margin:15mm 14mm 18mm}@media print{body{background:white;font-size:10pt;line-height:1.5}main{margin:0;max-width:none;border:0;border-radius:0;padding:0}header img{width:102px;height:89px}header{gap:18px}h1{font-size:22pt}h2{font-size:14pt;margin:23px 0 10px;padding-top:17px}h3{font-size:11pt}nav{display:none}table{font-size:8pt}th,td{padding:7px}.table-wrap{overflow:visible}code{font-size:8.5pt}a{color:#00627b}footer{font-size:8pt}}
</style></head><body><main><header><img alt="Recanto das Asas" src="data:image/png;base64,''' + logo + '''"><div><div class="eyebrow">Guia de instalação • versão 0.1.0</div><strong>Windows 10/11 + Android 10 ou superior</strong><p>Servidor no seu desktop, acesso privado inclusive fora de casa.</p></div></header><nav aria-label="Etapas de instalação">''' + nav + '</nav>' + markdown_body(markdown) + '''<footer>Guia incluído no pacote. Não contém senha, chave de acesso nem registros do criatório.</footer></main></body></html>'''


def source_paths():
    try:
        result = subprocess.run(['git', '-C', str(ROOT), 'ls-files', '-z', '--cached'], check=True, capture_output=True)
        paths = [ROOT / name for name in result.stdout.decode().split('\0') if name]
    except (subprocess.CalledProcessError, FileNotFoundError):
        paths = []
        excluded = {'.git', 'node_modules', 'release', 'dist', '.gradle', 'build', 'test-results', 'playwright-report', '__pycache__'}
        for parent, directories, names in os.walk(ROOT):
            directories[:] = sorted(name for name in directories if name not in excluded)
            paths.extend(Path(parent) / name for name in sorted(names) if not name.startswith('.env') and not name.endswith('.tsbuildinfo'))
    return sorted(path for path in paths if path.is_file())


def make_source_zip(path):
    files = source_paths()
    required = {ROOT / 'docs/INSTALACAO_COMPLETA.md', Path(__file__).resolve(), APP / 'scripts/render-install-guide.mjs'}
    if not required.issubset(set(files)):
        raise RuntimeError('Stage the new guide and packaging scripts before collecting tracked source files.')
    with zipfile.ZipFile(path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for source in files:
            archive.write(source, 'recanto-das-asas/' + source.relative_to(ROOT).as_posix())
    return len(files)


def extract_server(source, destination):
    prefix = f'Recanto-das-Asas-Servidor-Windows-{VERSION}/'
    with zipfile.ZipFile(source) as archive:
        if archive.testzip() is not None:
            raise ValueError('Corrupt server ZIP')
        for item in archive.infolist():
            if item.is_dir():
                continue
            if not item.filename.startswith(prefix):
                raise ValueError('Unexpected server root')
            relative = PurePosixPath(item.filename[len(prefix):])
            if relative.is_absolute() or '..' in relative.parts or '\\' in str(relative):
                raise ValueError('Unsafe server entry')
            target = destination.joinpath(*relative.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(item))


def copy_documentation(stage):
    destination = stage / 'Documentacao'
    replacements = {
        '../aplicativo/release/windows/': '../Windows/',
        '../aplicativo/release/android/': '../Android/',
        f'../aplicativo/release/servidor-windows/Recanto-das-Asas-Servidor-Windows-{VERSION}.zip.sha256': '../Servidor-Windows/bundle-manifest.json',
        f'../aplicativo/release/servidor-windows/Recanto-das-Asas-Servidor-Windows-{VERSION}.zip': '../Servidor-Windows/',
        '../aplicativo/sync-server/README.md': 'SERVIDOR_TECNICO.md',
        '../aplicativo/sync-server/windows': '../Servidor-Windows/windows',
    }
    for source in sorted((ROOT / 'docs').iterdir()):
        if source.suffix not in ('.md', '.json') or source.name == 'INSTALACAO_COMPLETA.md':
            continue
        target = destination / source.name
        text = source.read_text('utf8')
        if source.suffix == '.md':
            for before, after in replacements.items():
                text = text.replace(before, after)
        target.write_text(text, encoding='utf8')
    technical = (APP / 'sync-server/README.md').read_text('utf8').replace('../../docs/SERVIDOR_WINDOWS.md', 'SERVIDOR_WINDOWS.md')
    (destination / 'SERVIDOR_TECNICO.md').write_text(technical, encoding='utf8')
    shutil.copyfile(APP / 'public/fonts/OFL.txt', destination / 'NotoSans-OFL.txt')


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    metadata = json.loads((ROOT / 'docs/ARTEFATOS.json').read_text('utf8'))
    entries = {entry['path']: entry for entry in metadata['artifacts']}
    inputs = {
        'windows': f'aplicativo/release/windows/Recanto-das-Asas-{VERSION}-x64-Setup.exe',
        'android': f'aplicativo/release/android/Recanto-das-Asas-{VERSION}-debug.apk',
        'server': f'aplicativo/release/servidor-windows/Recanto-das-Asas-Servidor-Windows-{VERSION}.zip',
    }
    for name in inputs.values():
        source, expected = ROOT / name, entries[name]
        if source.stat().st_size != expected['bytes'] or digest(source) != expected['sha256']:
            raise ValueError('Artifact differs from validated delivery: ' + name)
    source_zip = OUTPUT / f'Recanto-das-Asas-Codigo-Fonte-{VERSION}.zip'
    source_count = make_source_zip(source_zip)
    with tempfile.TemporaryDirectory(prefix='recanto-delivery-', dir=OUTPUT) as temporary:
        stage = Path(temporary) / PREFIX
        for name in ['Windows', 'Android', 'Servidor-Windows', 'Documentacao', 'Codigo-Fonte']:
            (stage / name).mkdir(parents=True)
        for name, folder in [('windows', 'Windows'), ('android', 'Android')]:
            shutil.copyfile(ROOT / inputs[name], stage / folder / Path(inputs[name]).name)
        shutil.copyfile(ROOT / 'PROMPT_DESENVOLVIMENTO.txt', stage / 'PROMPT_DESENVOLVIMENTO.txt')
        extract_server(ROOT / inputs['server'], stage / 'Servidor-Windows')
        shutil.copyfile(source_zip, stage / 'Codigo-Fonte' / source_zip.name)
        copy_documentation(stage)
        markdown = (ROOT / 'docs/INSTALACAO_COMPLETA.md').read_text('utf8')
        guide_html = stage / 'Guia-Instalacao.html'
        guide_pdf = stage / 'Guia-Instalacao.pdf'
        guide_html.write_text(make_html(markdown), encoding='utf8')
        (stage / 'Guia-Instalacao.md').write_text(markdown, encoding='utf8')
        subprocess.run(['node', str(APP / 'scripts/render-install-guide.mjs'), str(guide_html), str(guide_pdf)], check=True, cwd=APP)
        readme = (
            'RECANTO DAS ASAS - INSTALACAO COMPLETA 0.1.0\r\n\r\n'
            'Abra Guia-Instalacao.html no navegador ou Guia-Instalacao.pdf.\r\n'
            'Windows: instale o EXE da pasta Windows.\r\n'
            'Android: transfira o APK da pasta Android para o celular e instale.\r\n'
            'Servidor: execute Servidor-Windows\\01-Instalar.cmd no desktop.\r\n'
            'Instale Tailscale pelas fontes oficiais indicadas no guia, nos dois aparelhos.\r\n'
            'Depois execute 03-Conectar-Tailscale.cmd e 04-Mostrar-Conexao.cmd no desktop.\r\n'
            'Sincronize o Windows primeiro; no Android vazio escolha USAR A BASE REMOTA.\r\n'
            'Use a mesma senha do cofre nos dois aparelhos.\r\n'
            'O desktop deve ficar ligado, logado, conectado e sem suspender.\r\n'
            'Confira as condicoes do Tailscale para uso no criatorio antes de contratar um plano.\r\n'
            'Os binarios sao de avaliacao. Testes nos aparelhos fisicos ainda sao necessarios.\r\n'
            'Codigo-Fonte contem o projeto e originais; nao precisa dele para instalar.\r\n'
        )
        (stage / 'LEIA-PRIMEIRO.txt').write_bytes(readme.encode('utf8'))
        hashes = [(path.relative_to(stage).as_posix(), digest(path)) for path in sorted(stage.rglob('*')) if path.is_file()]
        (stage / 'SHA256SUMS.txt').write_text(''.join(f'{checksum}  {name}\n' for name, checksum in hashes), encoding='utf8')
        package = OUTPUT / f'{PREFIX}.zip'
        with zipfile.ZipFile(package, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for path in sorted(stage.rglob('*')):
                if not path.is_file():
                    continue
                stored = path.name.endswith(('.apk', '.zip')) or path.name.endswith('-Setup.exe')
                archive.write(path, PREFIX + '/' + path.relative_to(stage).as_posix(), compress_type=zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED)
        shutil.copyfile(guide_html, OUTPUT / guide_html.name)
        shutil.copyfile(guide_pdf, OUTPUT / guide_pdf.name)
        # Relative installer links are meaningful after extracting the full ZIP.
        (OUTPUT / 'Guia-Instalacao.md').write_text(markdown, encoding='utf8')
    records = []
    for path in [package, source_zip, OUTPUT / 'Guia-Instalacao.html', OUTPUT / 'Guia-Instalacao.pdf']:
        checksum = digest(path)
        path.with_name(path.name + '.sha256').write_text(f'{checksum}  {path.name}\n', encoding='ascii')
        records.append({'path': str(path.relative_to(ROOT)), 'bytes': path.stat().st_size, 'sha256': checksum})
    report = {'version': VERSION, 'source_files': source_count, 'artifacts': records, 'physical_installation_tested': False}
    (OUTPUT / 'ENTREGA.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
