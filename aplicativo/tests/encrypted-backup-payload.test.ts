import {afterEach, describe, expect, it, vi} from 'vitest';
import {encodeEncryptedBackupPayload, encryptedBackupPayload} from '../src/lib/encrypted-backup-payload';
import {sha256, type Envelope} from '../src/lib/storage';
const envelope:Envelope={schemaVersion:1,salt:'AA==',iv:'AQ==',ciphertext:'QUJD'.repeat(192*1024),iterations:310000};
const legacy=(value:Envelope)=>new TextEncoder().encode(JSON.stringify({format:'recanto-encrypted-backup',version:1,envelope:value}));
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
describe('serialização compatível do envelope criptografado',()=>{
 it('keeps every JSON byte, property order, size and hash without worker support',async()=>{
  vi.stubGlobal('Worker',undefined);const {bytes,hash}=await encryptedBackupPayload(envelope),expected=legacy(envelope);
  expect(bytes).toEqual(expected);expect(hash).toBe(await sha256(expected));expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual({format:'recanto-encrypted-backup',version:1,envelope});
  const reordered={iterations:310000,ciphertext:'ab+/==',iv:'texto " com acento ç',salt:'\\\n',schemaVersion:1} as Envelope;
  expect(encodeEncryptedBackupPayload(reordered)).toEqual(legacy(reordered));
 });
 it('sends only the encrypted envelope to a worker and consumes the transferred payload',async()=>{
  let sent:unknown,terminated=false;
  class SuccessfulWorker{
   onmessage:((event:MessageEvent)=>void)|null=null;onerror=null;onmessageerror=null;
   async postMessage(value:Envelope){sent=value;const bytes=legacy(value),hash=await sha256(bytes);this.onmessage?.({data:{kind:'encrypted-backup-payload',version:1,bytes:bytes.buffer,hash}} as MessageEvent);}
   terminate(){terminated=true;}
  }
  vi.stubGlobal('Worker',SuccessfulWorker);expect((await encryptedBackupPayload(envelope)).bytes).toEqual(legacy(envelope));expect(sent).toBe(envelope);expect(Object.keys(sent as object)).toEqual(['schemaVersion','salt','iv','ciphertext','iterations']);expect(terminated).toBe(true);
 });
 it.each(['constructor','postMessage','error','messageerror','invalid-message'])('falls back to the same bytes if worker %s fails',async failure=>{
  let terminated=false;
  class FailedWorker{
   onmessage:((event:MessageEvent)=>void)|null=null;onerror:((event:ErrorEvent)=>void)|null=null;onmessageerror:(()=>void)|null=null;
   constructor(){if(failure==='constructor')throw new Error('Worker indisponível.');}
   postMessage(){if(failure==='postMessage')throw new Error('Transferência indisponível.');queueMicrotask(()=>{if(failure==='error')this.onerror?.({preventDefault(){}} as ErrorEvent);else if(failure==='messageerror')this.onmessageerror?.();else this.onmessage?.({data:{error:'Mensagem inválida.'}} as MessageEvent);});}
   terminate(){terminated=true;}
  }
  vi.stubGlobal('Worker',FailedWorker);expect((await encryptedBackupPayload(envelope)).bytes).toEqual(legacy(envelope));expect(terminated).toBe(failure!=='constructor');
 });
 it('terminates a silent worker after timeout and returns the original payload and hash',async()=>{
  vi.useFakeTimers();let terminated=false;
  class SilentWorker{onmessage=null;onerror=null;onmessageerror=null;postMessage(){}terminate(){terminated=true;}}
  vi.stubGlobal('Worker',SilentWorker);const small={...envelope,ciphertext:'QUJD'},pending=encryptedBackupPayload(small);await vi.advanceTimersByTimeAsync(30000);const result=await pending;expect(terminated).toBe(true);expect(result.bytes).toEqual(legacy(small));expect(result.hash).toBe(await sha256(legacy(small)));
 });
 it('cancels a pending worker and releases its timeout without changing any stored backup',async()=>{
  vi.useFakeTimers();let terminated=false;
  class SilentWorker{onmessage=null;onerror=null;onmessageerror=null;postMessage(){}terminate(){terminated=true;}}
  vi.stubGlobal('Worker',SilentWorker);const controller=new AbortController(),pending=encryptedBackupPayload(envelope,controller.signal);controller.abort();await expect(pending).rejects.toMatchObject({name:'AbortError'});expect(terminated).toBe(true);expect(vi.getTimerCount()).toBe(0);await expect(encryptedBackupPayload(envelope,controller.signal)).rejects.toMatchObject({name:'AbortError'});
 });
});
