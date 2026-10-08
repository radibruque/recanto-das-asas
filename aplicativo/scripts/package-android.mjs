import { cp, mkdir, readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const windows = process.platform === 'win32';
const env = { ...process.env };
// Gradle/Java uses JVM proxy properties rather than HTTP(S)_PROXY.
const proxyArgs=[];
for(const [scheme,name] of [['https','HTTPS_PROXY'],['http','HTTP_PROXY']]) {
  if(!env[name])continue;
  const proxy=new URL(env[name]);
  if(proxy.username||proxy.password)throw new Error('Configure a autenticação do proxy Java pelo ambiente, sem embutir credenciais no projeto.');
  proxyArgs.push(`-D${scheme}.proxyHost=${proxy.hostname}`,`-D${scheme}.proxyPort=${proxy.port||80}`);
}
if(proxyArgs.length)env.GRADLE_OPTS=[env.GRADLE_OPTS||'',...proxyArgs,'-Dhttp.nonProxyHosts=localhost|127.*'].join(' ');

if (!env.ANDROID_HOME) {
  try { await stat('/workspace/tools/android-sdk'); env.ANDROID_HOME = '/workspace/tools/android-sdk'; }
  catch { throw new Error('Instale o Android SDK oficial e configure ANDROID_HOME. Veja docs/COMPILACAO.md.'); }
}
if (process.platform === 'linux' && !env.JAVA_HOME) {
  const roots=[];
  try { for(const folder of await readdir('/workspace/tools/java'))roots.push(path.join('/workspace/tools/java',folder)); } catch {}
  roots.push('/usr/lib/jvm/java-21-openjdk-amd64');
  for(const candidate of roots){try{await stat(path.join(candidate,'bin/javac'));env.JAVA_HOME=candidate;break;}catch{}}
  if(!env.JAVA_HOME)throw new Error('Configure JAVA_HOME para um JDK 21 completo, incluindo javac.');
}
if (env.ANDROID_HOME.startsWith('/workspace/')) {
  env.ANDROID_USER_HOME ||= '/workspace/tools/android-user';
  env.ANDROID_DEBUG_KEYSTORE ||= '/workspace/tools/android-user/debug.keystore';
  env.GRADLE_USER_HOME ||= '/workspace/tools/gradle-cache';
  await mkdir(env.ANDROID_USER_HOME, { recursive: true });
  await mkdir(env.GRADLE_USER_HOME, { recursive: true });
}
function run(binary, args, cwd = root) {
  const result = spawnSync(binary, args, { cwd, env, stdio: 'inherit', shell: windows && binary.endsWith('.bat') });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
if (!process.argv.includes('--skip-web-build')) run(windows ? 'npm.cmd' : 'npm', ['run', 'build']);
run(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android']);
const android = path.join(root, 'native/android');
await cp(path.join(root, 'native/android-icons'), path.join(android, 'app/src/main/res'), { recursive: true });
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const version = manifest.version;
const semver = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
if (!semver) throw new Error('A versão Android precisa de major.minor.patch, sem sufixo.');
const versionCode = Number(env.ANDROID_VERSION_CODE || Number(semver[1]) * 1_000_000 + Number(semver[2]) * 1_000 + Number(semver[3]));
if (!Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2_100_000_000) throw new Error('ANDROID_VERSION_CODE inválido.');
const release = process.argv.includes('--release');
if (release && ['ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD'].some((key) => !env[key])) {
  throw new Error('Build release exige chave própria: configure as quatro variáveis ANDROID_KEYSTORE_* e ANDROID_KEY_ALIAS; nunca coloque valores no código.');
}
run(windows ? path.join(android, 'gradlew.bat') : path.join(android, 'gradlew'), [
  '--no-daemon', '--max-workers=2', `-PappVersion=${version}`, `-PappVersionCode=${versionCode}`,
  release ? 'assembleRelease' : 'assembleDebug', 'lintDebug',
], android);
const variant = release ? 'release' : 'debug';
const output = path.join(root, 'release/android');
await mkdir(output, { recursive: true });
const name = `Recanto-das-Asas-${version}-${variant}.apk`;
await cp(path.join(android, `app/build/outputs/apk/${variant}/app-${variant}.apk`), path.join(output, name));
const sha256 = createHash('sha256').update(await readFile(path.join(output, name))).digest('hex');
await writeFile(path.join(output, `${name}.sha256`), `${sha256}  ${name}\n`);
console.log(release
  ? 'APK release gerado com a chave configurada. Verifique a assinatura e teste a atualização no aparelho.'
  : 'APK DEBUG gerado para avaliação privada. Não use esta chave temporária como identidade definitiva de publicação.');
