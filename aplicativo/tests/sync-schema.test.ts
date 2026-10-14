import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SyncClient, SyncConflictError, type SyncEnvelope } from '../src/lib/sync';

// Synthetic isolated fixtures. No credentials or records from a real installation.
const token = 'recanto-synthetic-schema-gate-token-32-characters';
const origin = 'https://synthetic-recanto.example';
let child: ChildProcess;
let directory: string;
let baseUrl: string;
const envelope = (label: string): SyncEnvelope => ({ schemaVersion: 1, salt: Buffer.alloc(16, 1).toString('base64'), iv: Buffer.alloc(12, 2).toString('base64'), ciphertext: Buffer.from(`synthetic-encrypted-schema-fixture-${label}`).toString('base64'), iterations: 310_000 });
const operation = (expectedRevision = 0, label = 'one') => ({ expectedRevision, operationId: randomUUID(), envelope: envelope(label) });
const client = (workspaceId: string) => new SyncClient({ url: baseUrl, token, workspaceId });
function route(workspaceId: string) { return `${baseUrl}/v1/workspace/${workspaceId}`; }
function legacyRequest(workspaceId: string, method = 'GET', body?: unknown) { return fetch(route(workspaceId), { method, headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) }); }
function modernRequest(workspaceId: string, method: string, schema: number, body?: unknown) { return fetch(route(workspaceId), { method, headers: { Authorization: `Bearer ${token}`, 'X-Recanto-Schema-Version': String(schema), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) }); }
async function start(): Promise<void> {
 child = spawn(process.execPath, [fileURLToPath(new URL('../sync-server/server.mjs', import.meta.url))], { env: { ...process.env, SYNC_TOKEN: token, SYNC_PORT: '0', SYNC_HOST: '127.0.0.1', SYNC_DATA_DIR: directory, SYNC_ALLOWED_ORIGINS: origin }, stdio: ['ignore', 'pipe', 'pipe'] });
 baseUrl = await new Promise<string>((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Schema fixture startup timeout')), 10_000); child.stdout!.once('data', data => { clearTimeout(timer); resolve(JSON.parse(String(data)).url); }); child.once('exit', () => { clearTimeout(timer); reject(new Error('Schema fixture exited')); }); });
}
async function stop(): Promise<void> { if (child.exitCode !== null) return; await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Schema fixture shutdown timeout')); }, 10_000); child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error('Schema fixture failed')); }); child.kill('SIGTERM'); }); }
async function readRecord(workspaceId: string) { return readFile(join(directory, `${workspaceId}.json`), 'utf8'); }
async function listen(server: Server) { await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const address = server.address(); if (!address || typeof address === 'string') throw new Error('Invalid fake server address'); return `http://127.0.0.1:${address.port}`; }
async function close(server: Server) { server.closeIdleConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
beforeAll(async () => { directory = await mkdtemp(join(tmpdir(), 'recanto-schema-gate-')); await start(); });
afterAll(async () => { await stop(); await rm(directory, { recursive: true, force: true }); });

describe('versioned compatibility without exposing encrypted business data', () => {
 it('preserves legacy reads/writes and does not promote a workspace by reading it', async () => {
  const workspace = `legacy-${randomUUID()}`;
  const original = operation();
  expect((await legacyRequest(workspace, 'PUT', original)).status).toBe(200);
  const oldFile = JSON.parse(await readRecord(workspace));
  delete oldFile.requiredClientSchemaVersion;
  await writeFile(join(directory, `${workspace}.json`), JSON.stringify(oldFile));
  const before = await readRecord(workspace);
  expect(await client(workspace).download()).toMatchObject({ revision: 1, envelope: original.envelope });
  const head = await modernRequest(workspace, 'HEAD', 3);
  expect(head.status).toBe(200); expect(await head.text()).toBe(''); expect(head.headers.get('X-Recanto-Required-Schema')).toBe('2');
  expect(await readRecord(workspace)).toBe(before);
  expect((await legacyRequest(workspace, 'GET')).status).toBe(200);
  expect((await legacyRequest(workspace, 'PUT', operation(1, 'legacy-next'))).status).toBe(200);
  expect(JSON.parse(await readRecord(workspace)).requiredClientSchemaVersion).toBe(2);
 });

 it('promotes only an accepted unique write and blocks stale clients without changing the encrypted record', async () => {
  const workspace = `promoted-${randomUUID()}`;
  const original = operation();
  expect(await client(workspace).upload(original)).toMatchObject({ revision: 1, duplicate: false });
  const before = await readRecord(workspace);
  expect(JSON.parse(before).requiredClientSchemaVersion).toBe(3);
  for (const method of ['GET', 'HEAD', 'PUT']) {
   const result = await legacyRequest(workspace, method, method === 'PUT' ? operation(1, 'stale') : undefined);
   expect(result.status).toBe(426); expect(result.headers.get('X-Recanto-Error')).toBe('CLIENT_UPDATE_REQUIRED');
   expect(result.headers.get('X-Recanto-Required-Schema')).toBe('3');
  }
  expect(await readRecord(workspace)).toBe(before);
  expect(await client(workspace).download()).toMatchObject({ revision: 1, envelope: original.envelope });
 });

 it('retains the legacy lost-ack receipt after an updated client retries it, without premature promotion', async () => {
  const workspace = `receipt-${randomUUID()}`;
  const original = operation();
  expect((await legacyRequest(workspace, 'PUT', original)).status).toBe(200);
  expect(await client(workspace).upload(original)).toMatchObject({ revision: 1, duplicate: true });
  expect(JSON.parse(await readRecord(workspace)).requiredClientSchemaVersion).toBe(2);
  expect((await legacyRequest(workspace)).status).toBe(200);
  await client(workspace).upload(operation(1, 'new-version'));
  expect(await client(workspace).upload(original)).toMatchObject({ revision: 1, currentRevision: 2, duplicate: true });
  expect(JSON.parse(await readRecord(workspace)).requiredClientSchemaVersion).toBe(3);
 });

 it('does not promote or overwrite on a revision conflict', async () => {
  const workspace = `conflict-${randomUUID()}`;
  const original = operation();
  await legacyRequest(workspace, 'PUT', original);
  const before = await readRecord(workspace);
  await expect(client(workspace).upload(operation(0, 'offline-new-version'))).rejects.toBeInstanceOf(SyncConflictError);
  expect(await readRecord(workspace)).toBe(before);
  expect((await legacyRequest(workspace)).status).toBe(200);
 });

 it('never downgrades a promoted base through a declared compatible client and a legacy body', async () => {
  const workspace = `downgrade-${randomUUID()}`;
  await client(workspace).upload(operation());
  const before = await readRecord(workspace);
  const stale = await modernRequest(workspace, 'PUT', 3, operation(1, 'old-body'));
  expect(stale.status).toBe(426); expect((await stale.json()).error).toBe('SCHEMA_DOWNGRADE_FORBIDDEN');
  expect(await readRecord(workspace)).toBe(before);
 });

 it('persists the schema floor and retry receipt across restart', async () => {
  const workspace = `restart-${randomUUID()}`;
  const original = operation();
  await client(workspace).upload(original);
  await stop(); await start();
  expect((await legacyRequest(workspace, 'PUT', operation(1, 'legacy-after-restart'))).status).toBe(426);
  expect(await client(workspace).upload(original)).toMatchObject({ revision: 1, duplicate: true });
  expect(await client(workspace).download()).toMatchObject({ revision: 1, envelope: original.envelope });
 });

 it('rejects newer schema floors on the current client without exposing an incompatible snapshot', async () => {
  const workspace = `future-${randomUUID()}`;
  const future = { ...operation(), requiredClientSchemaVersion: 4 };
  expect((await modernRequest(workspace, 'PUT', 4, future)).status).toBe(200);
  const before = await readRecord(workspace);
  await expect(client(workspace).download()).rejects.toMatchObject({ status: 426, code: 'CLIENT_UPDATE_REQUIRED', retryable: false });
  await expect(client(workspace).upload(operation(1, 'current'))).rejects.toMatchObject({ status: 426, code: 'CLIENT_UPDATE_REQUIRED', retryable: false });
  expect(await readRecord(workspace)).toBe(before);
 });

 it('authenticates lightweight HEAD and permits only exact CORS origins and schema headers', async () => {
  const workspace = `head-${randomUUID()}`;
  const unauthorized = await fetch(route(workspace), { method: 'HEAD' });
  expect(unauthorized.status).toBe(401); expect(await unauthorized.text()).toBe('');
  const ready = await fetch(route(workspace), { method: 'HEAD', headers: { Origin: origin, Authorization: `Bearer ${token}`, 'X-Recanto-Schema-Version': '3' } });
  expect(ready.status).toBe(200); expect(ready.headers.get('X-Recanto-Schema-Gate')).toBe('1'); expect(await ready.text()).toBe('');
  expect(ready.headers.get('Access-Control-Expose-Headers')).toContain('X-Recanto-Required-Schema');
  for (const method of ['HEAD','GET','PUT']) {
   const preflight = await fetch(route(workspace), { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': 'authorization, x-recanto-schema-version' } });
   expect(preflight.status).toBe(204);
  }
  expect((await fetch(route(workspace), { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'HEAD', 'Access-Control-Request-Headers': 'authorization, arbitrary-header' } })).status).toBe(403);
 });

 it('fails closed on corrupt persisted schema requirements', async () => {
  const workspace = `corrupt-${randomUUID()}`;
  await client(workspace).upload(operation());
  const corrupted = JSON.parse(await readRecord(workspace));
  corrupted.requiredClientSchemaVersion = '3';
  await writeFile(join(directory, `${workspace}.json`), JSON.stringify(corrupted));
  const before = await readRecord(workspace);
  await expect(client(workspace).download()).rejects.toMatchObject({ status: 500, code: 'STORAGE_ERROR' });
  expect(await readRecord(workspace)).toBe(before);
 });

 it('rejects unsupported schema declarations before touching a workspace', async () => {
  const workspace = `invalid-${randomUUID()}`;
  for (const value of [null, '3', 0, -1, 3.2]) {
   const result = await modernRequest(workspace, 'PUT', 3, { ...operation(), requiredClientSchemaVersion: value });
   expect(result.status).toBe(400);
  }
  expect((await client(workspace).download()).revision).toBe(0);
 });

 it('asks to update an older server before sending any snapshot', async () => {
  const observed: string[] = [];
  const oldServer = createServer((request, response) => { observed.push(request.method!); response.writeHead(405, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' })); });
  const oldUrl = await listen(oldServer);
  try {
   const pending = operation();
   const original = JSON.stringify(pending);
   await expect(new SyncClient({ url: oldUrl, token }).upload(pending)).rejects.toMatchObject({ status: 426, code: 'SERVER_UPDATE_REQUIRED', retryable: false });
   expect(observed).toEqual(['HEAD']); expect(JSON.stringify(pending)).toBe(original);
  } finally { await close(oldServer); }
 });

 it('keeps the protective field in PUT if a server is downgraded between the probe and the write', async () => {
  const observed: string[] = [];
  let received: Record<string, unknown> | undefined;
  const server = createServer((request, response) => {
   observed.push(request.method!);
   if (request.method === 'HEAD') { response.writeHead(200, { 'X-Recanto-Schema-Gate': '1', 'X-Recanto-Required-Schema': '2' }); response.end(); return; }
   let body = ''; request.on('data', data => { body += String(data); }); request.once('end', () => { received = JSON.parse(body); response.writeHead(400, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ error: 'INVALID_OPERATION' })); });
  });
  const downgradedUrl = await listen(server);
  try {
   const pending = operation();
   await expect(new SyncClient({ url: downgradedUrl, token }).upload(pending)).rejects.toMatchObject({ status: 400, code: 'INVALID_OPERATION', retryable: false });
   expect(observed).toEqual(['HEAD', 'PUT']); expect(received).toEqual({ ...pending, requiredClientSchemaVersion: 3 });
  } finally { await close(server); }
 });
});
