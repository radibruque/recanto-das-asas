import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = '0.1.0';
const runtimeVersion = '24.21.0';
const runtimeName = `node-v${runtimeVersion}-win-x64.zip`;
const runtimeUrl = `https://nodejs.org/dist/v${runtimeVersion}/${runtimeName}`;
// SHA-256 from the official HTTPS SHASUMS256.txt, verified when pinned.
const runtimeSha256 = '158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541';
const sha = data => createHash('sha256').update(data).digest('hex');
const argument = process.argv.slice(2).find(arg => arg.startsWith('--runtime-archive='));
const runtime = argument
  ? await readFile(resolve(argument.slice('--runtime-archive='.length)))
  : Buffer.from(await (async () => {
      const response = await fetch(runtimeUrl);
      if (!response.ok) throw new Error(`Official Node download failed: HTTP ${response.status}`);
      return response.arrayBuffer();
    })());
if (sha(runtime) !== runtimeSha256) throw new Error('Runtime checksum mismatch; refusing to package.');
const nodeArchive = await JSZip.loadAsync(runtime, { checkCRC32: true });
const files = new Map();
for (const [name, original] of [['node.exe', 'node.exe'], ['NODE-LICENSE.txt', 'LICENSE']]) {
  const entry = nodeArchive.file(`node-v${runtimeVersion}-win-x64/${original}`);
  if (!entry) throw new Error(`Official Node archive is missing ${original}`);
  files.set(name, await entry.async('nodebuffer'));
}
files.set('server.mjs', await readFile(join(app, 'sync-server', 'server.mjs')));
for (const name of (await readdir(join(app, 'sync-server', 'windows'))).sort()) {
  const source = await readFile(join(app, 'sync-server', 'windows', name), 'utf8');
  if (name.endsWith('.ps1')) {
    // Windows PowerShell 5.1 recognizes UTF-8 reliably with a BOM.
    files.set(`windows/${name}`, Buffer.from('\ufeff' + source.replace(/^\ufeff/, '').replace(/\r?\n/g, '\r\n')));
  } else if (name.endsWith('.cmd')) {
    files.set(name, Buffer.from(source.replace(/\r?\n/g, '\r\n'), 'ascii'));
  }
}
files.set('LEIA_PRIMEIRO.txt', Buffer.from(`RECANTO DAS ASAS - SERVIDOR PRIVADO WINDOWS ${version}\r\n\r\n` +
  '1. Se aparecer Desbloquear nas Propriedades do ZIP, marque antes de extrair.\r\n' +
  '2. Extraia tudo e execute 01-Instalar.cmd. Node oficial incluido; nao requer npm.\r\n' +
  '3. Instale Tailscale no Windows e no Android, conectando os dois a sua rede privada.\r\n' +
  '   Confira um plano compativel com seu uso no criatorio, sem ativar cobrancas indevidas.\r\n' +
  '4. Execute 03-Conectar-Tailscale.cmd. Habilite HTTPS/Serve se a conta solicitar.\r\n' +
  '   Nunca habilite Funnel para este servidor. Nao abra portas no roteador.\r\n' +
  '5. Use 04-Mostrar-Conexao.cmd e copie endereco, base principal e chave somente\r\n' +
  '   para a tela Sincronizacao dos seus aplicativos. Use a mesma senha do cofre.\r\n' +
  '6. Sincronize primeiro o Windows. No Android vazio escolha usar a base remota\r\n' +
  '   existente, preservando a copia local. Nunca sobrescreva a remota com vazio.\r\n' +
  '7. Confira com dados ficticios em uma base de avaliacao separada, inclusive pelo\r\n' +
  '   Android com Wi-Fi desligado e 4G/5G ligado.\r\n\r\n' +
  'Instalacao: %LOCALAPPDATA%\\RecantoDasAsasSync\\program\r\n' +
  'Dados e chave privada: %LOCALAPPDATA%\\RecantoDasAsasSync\r\n' +
  'Inicio automatico somente apos entrar na mesma conta do Windows.\r\n' +
  'O desktop precisa ficar ligado, conectado e sem suspender.\r\n' +
  '02-Iniciar.cmd retoma; 05-Parar.cmd encerra; 06-Desativar-Inicio-Automatico.cmd\r\n' +
  'remove somente o inicio automatico. Todos os auxiliares ficam na pasta program.\r\n' +
  'A chave DPAPI depende deste usuario Windows. Nao e a senha do cofre.\r\n' +
  'Mantenha backups completos .ra-backup fora do computador; sincronizacao nao e backup.\r\n' +
  'Limite por envio: 64 MiB de JSON (~48 MiB cifrados), incluindo anexos.\r\n' +
  'Scripts sem assinatura: avaliacao privada. Windows e Android reais ainda precisam\r\n' +
  'ser validados. Guia completo: docs/SERVIDOR_WINDOWS.md no projeto.\r\n'));

const manifest = {
  version, runtimeVersion, runtimeUrl, runtimeArchiveSha256: runtimeSha256,
  files: [...files].map(([path, data]) => ({ path, bytes: data.length, sha256: sha(data) })),
};
files.set('bundle-manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
const zip = new JSZip();
const root = `Recanto-das-Asas-Servidor-Windows-${version}/`;
for (const [path, data] of files) zip.file(root + path, data, { date: new Date('2026-10-08T00:00:00Z') });
const result = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
const output = join(app, 'release', 'servidor-windows');
await mkdir(output, { recursive: true });
const name = `Recanto-das-Asas-Servidor-Windows-${version}.zip`;
await writeFile(join(output, name), result);
await writeFile(join(output, `${name}.sha256`), `${sha(result)}  ${name}\n`);
console.log(JSON.stringify({ path: join(output, name), bytes: result.length, sha256: sha(result), runtimeVersion, files: files.size }, null, 2));
