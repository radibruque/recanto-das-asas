import type { Envelope } from './storage';
const workerScope=self as unknown as {onmessage:((event:MessageEvent<Envelope>)=>void)|null;postMessage:(message:unknown,transfer?:Transferable[])=>void};
workerScope.onmessage=async event=>{
 try{
  const bytes=new TextEncoder().encode(JSON.stringify({format:'recanto-encrypted-backup',version:1,envelope:event.data}));
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.buffer)),value=>value.toString(16).padStart(2,'0')).join('');
  workerScope.postMessage({kind:'encrypted-backup-payload',version:1,bytes:bytes.buffer,hash},[bytes.buffer]);
 }catch(error){workerScope.postMessage({error:error instanceof Error?error.message:'Não foi possível preparar o backup criptografado.'});}
};
