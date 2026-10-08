import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { SyncClient, SyncConflictError, SyncHttpError, SyncTransportError, type SyncEnvelope } from '../src/lib/sync';

// Public test fixture only. A real deployment supplies its own token securely.
const token = 'recanto-synthetic-test-token-32-characters';
const approvedOrigin = 'http://127.0.0.1:5173';
const envelope = (label = 'one'): SyncEnvelope => ({
  schemaVersion: 1,
  salt: Buffer.alloc(16, 1).toString('base64'),
  iv: Buffer.alloc(12, 2).toString('base64'),
  ciphertext: Buffer.from(`synthetic-encrypted-fixture-${label}`).toString('base64'),
  iterations: 310_000,
});
let directory: string;
let url: string;
let processServer: ChildProcess;

async function startServer(controlStdin = false): Promise<void> {
  processServer = spawn(process.execPath, [fileURLToPath(new URL('../sync-server/server.mjs', import.meta.url))], {
    env: { ...process.env, SYNC_TOKEN: token, SYNC_PORT: '0', SYNC_HOST: '127.0.0.1', SYNC_DATA_DIR: directory, SYNC_ALLOWED_ORIGINS: `${approvedOrigin},app://recanto,https://localhost`, SYNC_CONTROL_STDIN: controlStdin ? '1' : '0' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  url = await new Promise<string>((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Private sync fixture did not start')), 10_000);
    processServer.once('exit', () => { clearTimeout(timer); reject(new Error('Private sync fixture exited before listening')); });
    processServer.stdout!.on('data', chunk => {
      output += chunk.toString();
      const newline = output.indexOf('\n');
      if (newline !== -1) {
        clearTimeout(timer);
        try { resolve(JSON.parse(output.slice(0, newline)).url); } catch { reject(new Error('Invalid sync fixture startup message')); }
      }
    });
  });
}

async function stopServer(): Promise<void> {
  if (!processServer || processServer.exitCode !== null || processServer.signalCode !== null) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { processServer.kill('SIGKILL'); reject(new Error('Private sync fixture did not stop cleanly')); }, 10_000);
    processServer.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error('Private sync fixture failed to stop')); });
    processServer.kill('SIGTERM');
  });
}

const client = (workspaceId = `test-${randomUUID()}`) => new SyncClient({ url, token, workspaceId });
const put = (expectedRevision = 0, label = 'one') => ({ expectedRevision, operationId: randomUUID(), envelope: envelope(label) });

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'recanto-sync-test-'));
  await startServer();
});
afterAll(async () => {
  await stopServer();
  await rm(directory, { recursive: true, force: true });
});

describe('actual private sync server and client protocol', () => {
  it('stops through the private Windows control pipe and preserves records for restart', async () => {
    await stopServer();
    await startServer(true);
    const workspaceId = `windows-stop-${randomUUID()}`;
    const operation = put();
    await client(workspaceId).upload(operation);
    const stopped = new Promise<number | null>(resolve => processServer.once('exit', resolve));
    processServer.stdin!.write('recanto-sync-stop-v1\n');
    expect(await stopped).toBe(0);
    await expect(readFile(join(directory, 'server.lock'))).rejects.toMatchObject({ code: 'ENOENT' });
    await startServer();
    expect(await client(workspaceId).download()).toMatchObject({ revision: 1, envelope: operation.envelope });
  });

  it('releases the lock if the private controller pipe closes unexpectedly', async () => {
    await stopServer();
    await startServer(true);
    const stopped = new Promise<number | null>(resolve => processServer.once('exit', resolve));
    processServer.stdin!.end();
    expect(await stopped).toBe(0);
    await expect(readFile(join(directory, 'server.lock'))).rejects.toMatchObject({ code: 'ENOENT' });
    await startServer();
    expect((await client().download()).revision).toBe(0);
  });
  it.each(['app://recanto','https://localhost'])('accepts the exact packaged client origin %s with authentication',async origin=>{
    const response=await fetch(`${url}/v1/workspace/packaged-origin-test`,{headers:{Origin:origin,Authorization:`Bearer ${token}`}});
    expect(response.status).toBe(200);expect(response.headers.get('access-control-allow-origin')).toBe(origin);
  });
  it('starts with an empty workspace and round-trips only the opaque encrypted envelope', async () => {
    const device = client();
    expect(await device.download()).toEqual({ workspaceId: device.workspaceId, revision: 0, updatedAt: null, envelope: null });
    const operation = put();
    expect(await device.upload(operation)).toMatchObject({ revision: 1, currentRevision: 1, duplicate: false });
    expect(await device.download()).toMatchObject({ revision: 1, envelope: operation.envelope });
    const saved = JSON.parse(await readFile(join(directory, `${device.workspaceId}.json`), 'utf8'));
    expect(saved.envelope).toEqual(operation.envelope);
    expect(Object.keys(saved.operations)).toEqual([operation.operationId]);
    expect(saved.operations[operation.operationId]).not.toHaveProperty('envelope');
  });

  it('round-trips a real AES-GCM snapshot without persisting plaintext', async () => {
    const device = client();
    const secretRecord = JSON.stringify({ syntheticTest: true, privateNote: 'registros privados de teste' });
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(secretRecord));
    const encrypted: SyncEnvelope = { ...envelope(), iv: Buffer.from(iv).toString('base64'), ciphertext: Buffer.from(ciphertext).toString('base64') };
    await device.upload({ ...put(), envelope: encrypted });
    const remote = (await device.download()).envelope!;
    const recovered = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(remote.iv, 'base64') }, key, Buffer.from(remote.ciphertext, 'base64'));
    expect(new TextDecoder().decode(recovered)).toBe(secretRecord);
    expect(await readFile(join(directory, `${device.workspaceId}.json`), 'utf8')).not.toContain(secretRecord);
  });

  it('rejects unauthenticated reads and writes', async () => {
    const device = client();
    for (const method of ['GET', 'PUT']) {
      const response = await fetch(`${url}/v1/workspace/${device.workspaceId}`, { method });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'UNAUTHORIZED' });
    }
    await expect(new SyncClient({ url, token: 'wrong-token-with-at-least-32-characters' }).download()).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED', retryable: false });
  });

  it('allows only exact configured origins and checks preflight without exposing data', async () => {
    const route = `${url}/v1/workspace/principal`;
    const allowed = await fetch(route, { headers: { Origin: approvedOrigin, Authorization: `Bearer ${token}` } });
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(approvedOrigin);
    const preflight = await fetch(route, { method: 'OPTIONS', headers: { Origin: approvedOrigin, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'authorization, content-type' } });
    expect(preflight.status).toBe(204);
    expect(await preflight.text()).toBe('');
    const forbidden = await fetch(route, { headers: { Origin: 'https://attacker.example', Authorization: `Bearer ${token}` } });
    expect(forbidden.status).toBe(403);
    expect(forbidden.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect((await fetch(route, { method: 'OPTIONS' })).status).toBe(403);
    expect((await fetch(route, { method: 'OPTIONS', headers: { Origin: approvedOrigin, 'Access-Control-Request-Method': 'DELETE' } })).status).toBe(403);
  });

  it('compares and swaps concurrent updates so exactly one device wins', async () => {
    const deviceA = client();
    const deviceB = client(deviceA.workspaceId);
    const operations = [put(0, 'device-a'), put(0, 'device-b')];
    const results = await Promise.allSettled([deviceA.upload(operations[0]), deviceB.upload(operations[1])]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const conflict = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(conflict.reason).toBeInstanceOf(SyncConflictError);
    expect(conflict.reason.snapshot.revision).toBe(1);
    expect((await deviceA.download()).revision).toBe(1);
  });

  it('does not duplicate an operation when an accepted response is retried', async () => {
    const device = client();
    const operation = put();
    const first = await device.upload(operation);
    const retry = await device.upload(operation);
    expect(first.duplicate).toBe(false);
    expect(retry).toEqual({ ...first, duplicate: true });
    expect((await device.download()).revision).toBe(1);
    await expect(device.upload({ ...operation, envelope: envelope('different') })).rejects.toMatchObject({ status: 409, code: 'OPERATION_ID_REUSED' });
    await expect(device.upload({ ...operation, expectedRevision: 1 })).rejects.toMatchObject({ status: 409, code: 'OPERATION_ID_REUSED' });
  });

  it('preserves the original retry receipt after a newer change without overwriting the newer snapshot', async () => {
    const device = client();
    const original = put();
    await device.upload(original);
    const newer = put(1, 'newer');
    await device.upload(newer);
    expect(await device.upload(original)).toMatchObject({ revision: 1, currentRevision: 2, duplicate: true });
    expect(await device.download()).toMatchObject({ revision: 2, envelope: newer.envelope });
  });

  it('keeps conflict changes explicit and allows retry only after an intentional revision choice', async () => {
    const device = client();
    await device.upload(put());
    const local = put(0, 'offline-local');
    await expect(device.upload(local)).rejects.toBeInstanceOf(SyncConflictError);
    const remote = await device.download();
    expect(remote.envelope).not.toEqual(local.envelope);
    // The application must back up both sides and ask the user before this intentional replace.
    expect(await device.upload({ ...local, expectedRevision: remote.revision })).toMatchObject({ revision: 2, duplicate: false });
  });

  it('persists both the snapshot and retry journal across a real server restart', async () => {
    const workspaceId = `restart-${randomUUID()}`;
    const operation = put(0, 'persistent');
    await client(workspaceId).upload(operation);
    await stopServer();
    await startServer();
    const restarted = client(workspaceId);
    expect(await restarted.download()).toMatchObject({ revision: 1, envelope: operation.envelope });
    expect(await restarted.upload(operation)).toMatchObject({ revision: 1, duplicate: true });
    expect((await restarted.download()).revision).toBe(1);
  });

  it('keeps workspaces isolated', async () => {
    const one = client();
    const two = client();
    await one.upload(put());
    expect((await two.download()).revision).toBe(0);
    expect((await one.download()).revision).toBe(1);
  });

  it('rejects plaintext or malformed envelopes without changing data', async () => {
    const device = client();
    for (const invalid of [
      { plaintext: 'private data', schemaVersion: 1 },
      { ...envelope(), iv: 'not-base64' },
      { ...envelope(), iterations: 1 },
      { ...envelope(), ciphertext: Buffer.from('too-small').toString('base64') },
      { ...envelope(), unexpected: 'plaintext' },
    ]) {
      const response = await fetch(`${url}/v1/workspace/${device.workspaceId}`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...put(), envelope: invalid }),
      });
      expect(response.status).toBe(400);
    }
    expect((await device.download()).revision).toBe(0);
  });

  it('handles multi-megabyte encrypted attachments without regex stack overflow', async () => {
    const device = client();
    const operation = { ...put(), envelope: { ...envelope(), ciphertext: Buffer.alloc(8 * 1024 * 1024, 3).toString('base64') } };
    expect(await device.upload(operation)).toMatchObject({ revision: 1 });
    expect((await device.download()).envelope?.ciphertext).toBe(operation.envelope.ciphertext);
  });

  it('rejects unsafe endpoints and invalid operation metadata before requests', async () => {
    for (const unsafe of ['http://192.168.1.7:8788', 'http://localhost.example', 'https://token@example.com', 'https://example.com?secret=x', 'ftp://localhost']) {
      expect(() => new SyncClient({ url: unsafe, token })).toThrow();
    }
    expect(() => new SyncClient({ url, token: 'short' })).toThrow();
    expect(() => new SyncClient({ url, token, workspaceId: '../escape' })).toThrow();
    await expect(client().upload({ ...put(), expectedRevision: -1 })).rejects.toThrow('Operação inválida');
    await expect(client().upload({ ...put(), operationId: 'short' })).rejects.toThrow('Operação inválida');
  });

  it('fails closed on invalid persisted data', async () => {
    const device = client();
    await device.upload(put());
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(directory, `${device.workspaceId}.json`), '{invalid-json');
    await expect(device.download()).rejects.toMatchObject({ status: 500, code: 'STORAGE_ERROR' });
    expect(await readFile(join(directory, `${device.workspaceId}.json`), 'utf8')).toBe('{invalid-json');
  });

  it('leaves transport failures retryable without changing the operation identifier', async () => {
    const device = new SyncClient({ url: 'http://127.0.0.1:1', token, timeoutMs: 200 });
    const operation = put();
    await expect(device.upload(operation)).rejects.toBeInstanceOf(SyncTransportError);
    expect(operation.operationId).toBeDefined();
  });

  it('uses explicit nonretryable operation errors rather than treating every 409 as a revision conflict', async () => {
    const device = client();
    const operation = put();
    await device.upload(operation);
    try {
      await device.upload({ ...operation, envelope: envelope('altered') });
      expect.fail('Expected idempotency rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(SyncHttpError);
      expect(error).not.toBeInstanceOf(SyncConflictError);
      expect((error as SyncHttpError).retryable).toBe(false);
    }
  });
});
