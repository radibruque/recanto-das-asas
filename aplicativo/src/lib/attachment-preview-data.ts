import { decodeAttachmentBase64 as base64ToBytes, MAX_ATTACHMENT_BYTES } from './attachment-base64';
import { imageDimensions } from './attachment-image-dimensions';

export type PreviewPayload = {base64:string;mime:string;sha256:string};
export type DecodedPreview = {bytes:Uint8Array;dimensions:{width:number;height:number}|null};
export const PREVIEW_INTEGRITY_ERROR = 'O arquivo não passou na verificação de integridade.';

export function assertPreviewActive(signal?:AbortSignal):void {
  if (signal?.aborted) throw new DOMException('Prévia cancelada.', 'AbortError');
}

/** A macrotask also gives input, rendering and scrolling a chance to run. */
export async function yieldPreview(signal?:AbortSignal):Promise<void> {
  assertPreviewActive(signal);
  await new Promise<void>(resolve=>setTimeout(resolve,0));
  assertPreviewActive(signal);
}

/** Same alphabet/padding and byte limit as the domain decoder; bounded work per turn. */
export async function decodePreviewBase64(value:string,signal?:AbortSignal):Promise<Uint8Array> {
  if(value.length>Math.ceil(MAX_ATTACHMENT_BYTES/3)*4)throw new Error('O arquivo excede 10 MB.');
  if(!value.length||value.length%4!==0)throw new Error('Conteúdo do arquivo inválido.');
  const padding=value.endsWith('==')?2:value.endsWith('=')?1:0;
  const bytes=new Uint8Array(value.length/4*3-padding);
  let offset=0;
  for(let index=0;index<value.length;index+=65536){
    await yieldPreview(signal);
    const chunk=value.slice(index,index+65536);
    if(index+65536<value.length&&chunk.includes('='))throw new Error('Conteúdo do arquivo inválido.');
    const decoded=base64ToBytes(chunk);bytes.set(decoded,offset);offset+=decoded.length;
  }
  return bytes;
}

/** Native SHA-256 runs asynchronously. The compatible fallback yields between blocks. */
export async function previewSha256(bytes:Uint8Array,signal?:AbortSignal):Promise<string> {
  assertPreviewActive(signal);
  if(globalThis.crypto?.subtle){
    const digest=await crypto.subtle.digest('SHA-256',new Uint8Array(bytes));
    assertPreviewActive(signal);
    return Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
  }
  const constants=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const padded=new Uint8Array(Math.ceil((bytes.length+9)/64)*64);padded.set(bytes);padded[bytes.length]=128;
  const view=new DataView(padded.buffer);view.setUint32(padded.length-8,Math.floor(bytes.length/0x20000000));view.setUint32(padded.length-4,bytes.length*8>>>0);
  const rotr=(value:number,count:number)=>(value>>>count)|(value<<(32-count)),words=new Uint32Array(64);
  for(let offset=0;offset<padded.length;offset+=64){
    if(offset%32768===0)await yieldPreview(signal);
    for(let index=0;index<16;index++)words[index]=view.getUint32(offset+index*4);
    for(let index=16;index<64;index++){const a=words[index-15],b=words[index-2];words[index]=((rotr(a,7)^rotr(a,18)^(a>>>3))+words[index-16]+(rotr(b,17)^rotr(b,19)^(b>>>10))+words[index-7])>>>0;}
    let[a,b,c,d,e,f,g,hh]=h;
    for(let index=0;index<64;index++){const first=(hh+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+constants[index]+words[index])>>>0,second=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;hh=g;g=f;f=e;e=(d+first)>>>0;d=c;c=b;b=a;a=(first+second)>>>0;}
    [a,b,c,d,e,f,g,hh].forEach((value,index)=>{h[index]=(h[index]+value)>>>0;});
  }
  return h.map(value=>value.toString(16).padStart(8,'0')).join('');
}

export async function decodeVerifiedPreview(payload:PreviewPayload,signal?:AbortSignal,cooperative=true):Promise<DecodedPreview> {
  assertPreviewActive(signal);
  // The worker can use the same linear domain decoder without blocking the UI.
  const bytes=cooperative?await decodePreviewBase64(payload.base64,signal):base64ToBytes(payload.base64);
  if(await previewSha256(bytes,signal)!==payload.sha256)throw new Error(PREVIEW_INTEGRITY_ERROR);
  assertPreviewActive(signal);
  return {bytes,dimensions:payload.mime.startsWith('image/')?imageDimensions(bytes,payload.mime):null};
}
