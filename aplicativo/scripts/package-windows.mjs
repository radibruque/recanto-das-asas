import { cp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { build, Platform, Arch } from 'electron-builder';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
if (!process.argv.includes('--skip-web-build')) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { stdio: 'inherit', shell: false });
  if (result.status !== 0) process.exit(result.status || 1);
}
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const staging = path.join(root, 'release/staging');
await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await cp(path.join(root, 'dist'), path.join(staging, 'dist'), { recursive: true });
await cp(path.join(root, 'electron'), path.join(staging, 'electron'), { recursive: true });
await mkdir(path.join(staging, 'native'), { recursive: true });
await cp(path.join(root, 'native/icon.png'), path.join(staging, 'native/icon.png'));
await writeFile(path.join(staging, 'package.json'), JSON.stringify({
  name: manifest.name, version: manifest.version, description: 'Gestão privada Recanto das Asas',
  author: 'Recanto das Asas', main: 'electron/main.cjs', private: true,
}, null, 2));
const { default: config } = await import('../electron/builder.config.cjs');
await build({ projectDir: root, config, targets: Platform.WINDOWS.createTarget('dir', Arch.x64) });
// Standard NSIS writes its uninstaller during installation, so cross-building
// doesn't execute a Windows binary or require Wine.
const cache=process.env.ELECTRON_BUILDER_CACHE;
let compiler=process.env.RECANTO_MAKENSIS;
if(!compiler&&process.platform==='linux'&&cache) {
  const parent=path.join(cache,'nsis-3.0.4.1');const folders=await readdir(parent).catch(()=>[]);for(const folder of folders){const candidate=path.join(parent,folder,'linux/makensis');try{await readFile(candidate);compiler=candidate;break;}catch{}}
}
if(!compiler)compiler=process.platform==='win32'?'makensis.exe':'makensis';
const installer=path.join(root,'release/windows',`Recanto-das-Asas-${manifest.version}-x64-Setup.exe`);
const result=spawnSync(compiler,[`-DAPP_ICON=${path.join(root,'native/icon.ico')}`,`-DAPP_DIR=${path.join(root,'release/windows/win-unpacked')}`,`-DOUT_FILE=${installer}`,`-DAPP_VERSION=${manifest.version}`,path.join(root,'native/installer.nsi')],{stdio:'inherit',env:{...process.env,...(process.platform==='linux'&&compiler.includes('/')?{NSISDIR:process.env.RECANTO_NSISDIR||path.dirname(path.dirname(compiler))}:{})}});
if(result.error)throw new Error('NSIS indisponível. Instale o compilador NSIS oficial e configure RECANTO_MAKENSIS.');
if(result.status!==0)process.exit(result.status||1);
if(process.env.CSC_LINK)throw new Error('O instalador foi gerado; assine-o com sua ferramenta Authenticode e verifique a assinatura antes de distribuir.');

const output = path.join(root, 'release/windows');
const installers = (await readdir(output)).filter((file) => file.endsWith('.exe'));
const checksums = await Promise.all(installers.map(async (file) => `${createHash('sha256').update(await readFile(path.join(output, file))).digest('hex')}  ${file}`));
await writeFile(path.join(output, 'SHA256SUMS.txt'), `${checksums.join('\n')}\n`);
console.log(process.env.CSC_LINK
  ? 'Instalador assinado gerado. Valide a assinatura no Windows antes de distribuir.'
  : 'Instalador SEM assinatura comercial gerado para validação. O Windows pode mostrar aviso de origem.');
