import { beforeEach, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { Vault } from '../src/lib/storage';

beforeEach(() => Object.defineProperty(globalThis, 'indexedDB', { value: new IDBFactory(), configurable: true }));

it('confirms opt-in credentials without replacing the open session or altering stored data', async () => {
  const vault = new Vault();
  const original = await vault.create('senha-ficticia-biometria');
  await expect(vault.verifyPassword('senha-incorreta')).rejects.toThrow(/Senha incorreta/);
  await vault.verifyPassword('senha-ficticia-biometria');
  expect(await vault.load()).toEqual(original);
});

it('does not unlock a locked vault merely by validating an enrollment credential', async () => {
  const vault = new Vault();
  await vault.create('senha-ficticia-biometria');
  vault.lock();
  await vault.verifyPassword('senha-ficticia-biometria');
  await expect(vault.load()).rejects.toThrow(/Desbloqueie/);
  await expect(new Vault().load()).rejects.toThrow(/Desbloqueie/);
});
