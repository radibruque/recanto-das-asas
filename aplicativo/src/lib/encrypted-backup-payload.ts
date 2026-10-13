import { sha256, type Envelope } from './storage';
export type EncryptedBackupPayload={bytes:Uint8Array;hash:string};

export function encodeEncryptedBackupPayload(envelope:Envelope):Uint8Array{
 return new TextEncoder().encode(JSON.stringify({format:'recanto-encrypted-backup',version:1,envelope}));
}
const aborted=(signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException('Operação cancelada.','AbortError');};
async function fallbackPayload(envelope:Envelope,signal?:AbortSignal):Promise<EncryptedBackupPayload>{aborted(signal);const bytes=encodeEncryptedBackupPayload(envelope),hash=await sha256(bytes);aborted(signal);return {bytes,hash};}

// Only the already encrypted envelope crosses the worker boundary. Devices without
// workers use the original serialization and SHA-256, preserving format and bytes.
export async function encryptedBackupPayload(envelope:Envelope,signal?:AbortSignal):Promise<EncryptedBackupPayload>{
 aborted(signal);if(typeof Worker==='undefined')return fallbackPayload(envelope,signal);
 let worker:Worker;
 try{worker=new Worker(new URL('./encrypted-backup-payload.worker.ts',import.meta.url),{type:'module'});}catch{return fallbackPayload(envelope,signal);}
 return new Promise((resolve,reject)=>{
  let settled=false;
  const cleanup=()=>{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);worker.terminate();};
  const cancel=()=>{if(settled)return;settled=true;cleanup();reject(new DOMException('Operação cancelada.','AbortError'));};
  const fallback=()=>{if(settled)return;settled=true;cleanup();fallbackPayload(envelope,signal).then(resolve,reject);};
  const timeout=setTimeout(fallback,30000);
  signal?.addEventListener('abort',cancel,{once:true});
  worker.onmessage=(event:MessageEvent<{kind?:string;version?:number;bytes?:ArrayBuffer;hash?:string;error?:string}>)=>{
   if(settled)return;const value=event.data;
   if(value?.kind!=='encrypted-backup-payload'||value.version!==1||!(value.bytes instanceof ArrayBuffer)||!value.bytes.byteLength||typeof value.hash!=='string'||!/^[a-f0-9]{64}$/.test(value.hash)){fallback();return;}
   settled=true;cleanup();resolve({bytes:new Uint8Array(value.bytes),hash:value.hash});
  };
  worker.onerror=event=>{event.preventDefault();fallback();};worker.onmessageerror=fallback;
  try{worker.postMessage(envelope);}catch{fallback();}
 });
}
