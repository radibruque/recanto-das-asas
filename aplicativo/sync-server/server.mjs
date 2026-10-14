import { createServer } from 'node:http';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { isIP } from 'node:net';
import { hostname } from 'node:os';
import { createInterface } from 'node:readline';

const MAX_BYTES = 64 * 1024 * 1024;
const workspacePattern = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/;
const LEGACY_SCHEMA_VERSION = 2;
const schemaPattern = /^[1-9]\d{0,5}$/;
const isSchemaVersion = value => Number.isSafeInteger(value) && value >= LEGACY_SCHEMA_VERSION && value <= 999_999;
const operationPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/;
const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
const isRevision = value => Number.isSafeInteger(value) && value >= 0;
const hash = value => createHash('sha256').update(value).digest('hex');
const jsonError = (status, code) => Object.assign(new Error(code), { status, code });
const validBase64 = (value, minimumBytes, exactBytes) => {
  if (typeof value !== 'string' || !value.length || value.length > MAX_BYTES || value.length % 4) return false;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const body = value.slice(0, value.length - padding);
  if (!body.length || /[^A-Za-z0-9+/]/.test(body)) return false;
  const bytes = Buffer.from(value, 'base64');
  return bytes.toString('base64') === value && bytes.length >= minimumBytes && (exactBytes === undefined || bytes.length === exactBytes);
};
const validEnvelope = value => isRecord(value)
  && Object.keys(value).sort().join(',') === 'ciphertext,iterations,iv,salt,schemaVersion'
  && value.schemaVersion === 1 && validBase64(value.salt, 16) && validBase64(value.iv, 12, 12) && validBase64(value.ciphertext, 16)
  && Number.isSafeInteger(value.iterations) && value.iterations >= 100_000 && value.iterations <= 2_000_000;
const canonicalEnvelope = envelope => JSON.stringify({ schemaVersion: envelope.schemaVersion, salt: envelope.salt, iv: envelope.iv, ciphertext: envelope.ciphertext, iterations: envelope.iterations });
const privateHost = host => ['127.0.0.1', '::1', 'localhost'].includes(host)
  || (isIP(host) === 4 && (host.startsWith('10.') || host.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(host)))
  || (isIP(host) === 6 && /^(fc|fd)/i.test(host));

const token = process.env.SYNC_TOKEN;
if (!token || token.length < 32 || /[\r\n]/.test(token)) throw new Error('SYNC_TOKEN must contain at least 32 characters; provide it securely outside the repository.');
const expectedTokenHash = createHash('sha256').update(`Bearer ${token}`).digest();
const host = process.env.SYNC_HOST || '127.0.0.1';
if (!privateHost(host)) throw new Error('SYNC_HOST must be loopback or a specific private-network address. Use a private HTTPS proxy for remote access.');
const port = Number(process.env.SYNC_PORT ?? 8788);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('SYNC_PORT must be a valid TCP port.');
const allowedOrigins = new Set((process.env.SYNC_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean));
for (const origin of allowedOrigins) {
  let url;
  try { url = new URL(origin); } catch { throw new Error('SYNC_ALLOWED_ORIGINS contains an invalid origin.'); }
  const normalized = url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : `${url.protocol}//${url.host}`;
  if (origin !== normalized || url.username || url.password || !['https:', 'http:', 'app:', 'capacitor:', 'tauri:'].includes(url.protocol)) throw new Error('SYNC_ALLOWED_ORIGINS requires exact origins without paths or credentials.');
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('HTTP origins are allowed only for loopback development.');
}
const dataDir = resolve(process.env.SYNC_DATA_DIR || '/workspace/local-sync');
await mkdir(dataDir, { recursive: true, mode: 0o700 });
const lockPath = join(dataDir, 'server.lock');
let lock;
try { lock = await open(lockPath, 'wx', 0o600); }
catch (error) {
  if (error.code === 'EEXIST') throw new Error('The data directory is already locked. Run one server per directory; after a crash, verify no server is running before removing server.lock.');
  throw error;
}
await lock.writeFile(JSON.stringify({ kind: 'recanto-sync-lock-v1', pid: process.pid, host: hostname() }));
await lock.close();

const queues = new Map();
async function serialized(workspaceId, action) {
  const previous = queues.get(workspaceId) || Promise.resolve();
  const running = previous.catch(() => {}).then(action);
  queues.set(workspaceId, running);
  try { return await running; }
  finally { if (queues.get(workspaceId) === running) queues.delete(workspaceId); }
}
const emptyRecord = () => ({ schemaVersion: 1, requiredClientSchemaVersion: LEGACY_SCHEMA_VERSION, revision: 0, updatedAt: null, envelope: null, operations: {} });
function validRecord(record) {
  return isRecord(record) && record.schemaVersion === 1 && isRevision(record.revision)
    && (record.requiredClientSchemaVersion === undefined || isSchemaVersion(record.requiredClientSchemaVersion))
    && (record.updatedAt === null || (typeof record.updatedAt === 'string' && !Number.isNaN(Date.parse(record.updatedAt))))
    && (record.envelope === null ? record.revision === 0 : record.revision > 0 && validEnvelope(record.envelope))
    && isRecord(record.operations) && Object.entries(record.operations).every(([id, operation]) => operationPattern.test(id)
      && isRecord(operation) && /^[a-f0-9]{64}$/.test(operation.fingerprint) && isRevision(operation.revision)
      && operation.revision > 0 && operation.revision <= record.revision && typeof operation.updatedAt === 'string' && !Number.isNaN(Date.parse(operation.updatedAt)));
}
async function loadRecord(workspaceId) {
  try {
    const record = JSON.parse(await readFile(join(dataDir, `${workspaceId}.json`), 'utf8'));
    if (!validRecord(record)) throw new Error('Invalid persisted record');
    // JSON may contain __proto__ as an operation key; use an own-property map.
    record.operations = Object.assign(Object.create(null), record.operations);
    // Old record files remain valid; reading does not rewrite or promote them.
    record.requiredClientSchemaVersion ??= LEGACY_SCHEMA_VERSION;
    return record;
  } catch (error) {
    if (error.code === 'ENOENT') return emptyRecord();
    throw jsonError(500, 'STORAGE_ERROR');
  }
}
async function saveRecord(workspaceId, record) {
  const temporary = join(dataDir, `.${workspaceId}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(JSON.stringify(record));
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, join(dataDir, `${workspaceId}.json`));
    // Persist rename metadata on platforms that support directory fsync.
    if (process.platform !== 'win32') {
      const directory = await open(dataDir, 'r');
      try { await directory.sync(); } finally { await directory.close(); }
    }
  } catch {
    await handle?.close().catch(() => {});
    await unlink(temporary).catch(() => {});
    throw jsonError(500, 'STORAGE_ERROR');
  }
}
function snapshot(workspaceId, record) {
  return { workspaceId, revision: record.revision, updatedAt: record.updatedAt, envelope: record.envelope };
}
async function readBody(request) {
  const declared = request.headers['content-length'];
  if (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES)) throw jsonError(413, 'BODY_TOO_LARGE');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BYTES) throw jsonError(413, 'BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw jsonError(400, 'INVALID_JSON'); }
}
function respond(response, status, body, origin, requiredClientSchemaVersion) {
  const data = body === undefined ? '' : JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    Vary: 'Origin',
    'X-Recanto-Schema-Gate': '1',
    ...(requiredClientSchemaVersion === undefined ? {} : { 'X-Recanto-Required-Schema': String(requiredClientSchemaVersion) }),
    ...(body?.error ? { 'X-Recanto-Error': body.error } : {}),
    ...(origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, PUT, HEAD, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Recanto-Schema-Version', 'Access-Control-Expose-Headers': 'X-Recanto-Schema-Gate, X-Recanto-Required-Schema, X-Recanto-Error', 'Access-Control-Max-Age': '600' } : {}),
  });
  response.end(data);
}

const server = createServer({ maxHeaderSize: 8192, requestTimeout: 60_000, headersTimeout: 15_000 }, async (request, response) => {
  let origin;
  try {
    const suppliedOrigin = request.headers.origin;
    if (suppliedOrigin !== undefined) {
      if (!allowedOrigins.has(suppliedOrigin)) throw jsonError(403, 'ORIGIN_FORBIDDEN');
      origin = suppliedOrigin;
    }
    const match = /^\/v1\/workspace\/([A-Za-z0-9][A-Za-z0-9_-]{2,63})$/.exec(request.url || '');
    if (!match) throw jsonError(404, 'NOT_FOUND');
    const workspaceId = match[1];
    if (request.method === 'OPTIONS') {
      // Browser preflight carries no bearer token; it reveals no data and needs an exact approved origin.
      if (!origin || !['GET', 'PUT', 'HEAD'].includes(request.headers['access-control-request-method'])
        || (request.headers['access-control-request-headers'] || '').split(',').some(h => h.trim() && !['authorization', 'content-type', 'x-recanto-schema-version'].includes(h.trim().toLowerCase()))) {
        throw jsonError(403, 'PREFLIGHT_FORBIDDEN');
      }
      return respond(response, 204, undefined, origin);
    }
    const suppliedTokenHash = createHash('sha256').update(request.headers.authorization || '').digest();
    if (!timingSafeEqual(expectedTokenHash, suppliedTokenHash)) throw jsonError(401, 'UNAUTHORIZED');
    if (!['GET', 'PUT', 'HEAD'].includes(request.method)) throw jsonError(405, 'METHOD_NOT_ALLOWED');
    const declaredSchema = request.headers['x-recanto-schema-version'];
    if (declaredSchema !== undefined && (typeof declaredSchema !== 'string' || !schemaPattern.test(declaredSchema) || !isSchemaVersion(Number(declaredSchema)))) throw jsonError(400, 'INVALID_CLIENT_SCHEMA');
    const clientSchemaVersion = declaredSchema === undefined ? LEGACY_SCHEMA_VERSION : Number(declaredSchema);
    const requireCompatible = record => {
      if (clientSchemaVersion < record.requiredClientSchemaVersion) {
        throw Object.assign(jsonError(426, 'CLIENT_UPDATE_REQUIRED'), { requiredClientSchemaVersion: record.requiredClientSchemaVersion });
      }
    };
    if (request.method === 'GET' || request.method === 'HEAD') {
      return await serialized(workspaceId, async () => {
        const record = await loadRecord(workspaceId);
        requireCompatible(record);
        return respond(response, 200, request.method === 'HEAD' ? undefined : snapshot(workspaceId, record), origin, record.requiredClientSchemaVersion);
      });
    }
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] || '')) throw jsonError(415, 'JSON_REQUIRED');
    const operation = await readBody(request);
    if (!isRecord(operation) || !['envelope,expectedRevision,operationId', 'envelope,expectedRevision,operationId,requiredClientSchemaVersion'].includes(Object.keys(operation).sort().join(','))
      || !isRevision(operation.expectedRevision) || !operationPattern.test(operation.operationId) || !validEnvelope(operation.envelope)) throw jsonError(400, 'INVALID_OPERATION');
    const requiredSchema = Object.hasOwn(operation, 'requiredClientSchemaVersion') ? operation.requiredClientSchemaVersion : LEGACY_SCHEMA_VERSION;
    if (!isSchemaVersion(requiredSchema) || requiredSchema > clientSchemaVersion) throw jsonError(400, 'INVALID_SCHEMA_DECLARATION');
    const fingerprint = hash(`${operation.expectedRevision}\n${canonicalEnvelope(operation.envelope)}`);
    await serialized(workspaceId, async () => {
      const record = await loadRecord(workspaceId);
      requireCompatible(record);
      if (requiredSchema < record.requiredClientSchemaVersion) throw Object.assign(jsonError(426, 'SCHEMA_DOWNGRADE_FORBIDDEN'), { requiredClientSchemaVersion: record.requiredClientSchemaVersion });
      const previous = Object.hasOwn(record.operations, operation.operationId) ? record.operations[operation.operationId] : undefined;
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw jsonError(409, 'OPERATION_ID_REUSED');
        return respond(response, 200, { workspaceId, revision: previous.revision, currentRevision: record.revision, updatedAt: previous.updatedAt, duplicate: true }, origin, record.requiredClientSchemaVersion);
      }
      if (operation.expectedRevision !== record.revision) return respond(response, 409, { error: 'REVISION_CONFLICT', snapshot: snapshot(workspaceId, record) }, origin, record.requiredClientSchemaVersion);
      if (record.revision >= Number.MAX_SAFE_INTEGER) throw jsonError(507, 'REVISION_EXHAUSTED');
      const next = record.revision + 1;
      const updatedAt = new Date().toISOString();
      record.revision = next;
      record.updatedAt = updatedAt;
      record.envelope = operation.envelope;
      // Promote together with the accepted snapshot and receipt; conflicts/retries do not promote.
      record.requiredClientSchemaVersion = Math.max(record.requiredClientSchemaVersion, requiredSchema);
      record.operations[operation.operationId] = { fingerprint, revision: next, updatedAt };
      await saveRecord(workspaceId, record);
      respond(response, 200, { workspaceId, revision: next, currentRevision: next, updatedAt, duplicate: false }, origin, record.requiredClientSchemaVersion);
    });
  } catch (error) {
    if (!response.headersSent && !response.destroyed) respond(response, error.status || 500, { error: error.code || 'INTERNAL_ERROR' }, origin, error.requiredClientSchemaVersion);
    else if (!response.writableEnded) response.destroy();
  }
});
server.maxRequestsPerSocket = 100;
server.keepAliveTimeout = 5000;
server.on('clientError', (_error, socket) => { if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); });
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  server.closeIdleConnections();
  await new Promise(resolveClose => server.close(resolveClose));
  await Promise.allSettled([...queues.values()]);
  await unlink(lockPath);
}
function requestShutdown() {
  if (stopping) return;
  shutdown().then(() => process.exit(0), () => process.exit(1));
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, requestShutdown);
// Windows TerminateProcess does not deliver SIGTERM. The private launcher owns
// this pipe and can request a graceful stop without exposing a network route.
if (process.env.SYNC_CONTROL_STDIN === '1') {
  const control = createInterface({ input: process.stdin, terminal: false });
  control.on('line', line => { if (line === 'recanto-sync-stop-v1') requestShutdown(); });
  control.once('close', requestShutdown);
}
server.once('error', async error => {
  await unlink(lockPath).catch(() => {});
  process.stderr.write(`Sync startup failed: ${error.code || 'SERVER_ERROR'}\n`);
  process.exit(1);
});
server.listen(port, host, () => {
  const address = server.address();
  const printableHost = host.includes(':') ? `[${host}]` : host;
  process.stdout.write(JSON.stringify({ event: 'listening', url: `http://${printableHost}:${address.port}` }) + '\n');
});
