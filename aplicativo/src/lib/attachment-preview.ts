import { assertPreviewActive, decodeVerifiedPreview, yieldPreview, type DecodedPreview, type PreviewPayload } from './attachment-preview-data';

type Waiter={signal:AbortSignal;ready:(release:()=>void)=>void;reject:(error:unknown)=>void;abort:()=>void};
let processing=0;
const waiting:Waiter[]=[];
class PreviewWorkerUnavailable extends Error {}

function releaseTurn():void {
  processing--;
  const next=waiting.shift();
  if(next){next.signal.removeEventListener('abort',next.abort);processing++;next.ready(releaseTurn);}
}

/** At most two pictures are prepared at once, including the cooperative fallback. */
async function takeTurn(signal:AbortSignal):Promise<()=>void> {
  assertPreviewActive(signal);
  if(processing<2){processing++;return releaseTurn;}
  return new Promise((resolve,reject)=>{
    const waiter:Waiter={signal,ready:resolve,reject,abort:()=>{const index=waiting.indexOf(waiter);if(index>=0)waiting.splice(index,1);reject(new DOMException('Prévia cancelada.','AbortError'));}};
    waiting.push(waiter);signal.addEventListener('abort',waiter.abort,{once:true});
  });
}

async function decodeInWorker(payload:PreviewPayload,signal:AbortSignal):Promise<DecodedPreview> {
  if(typeof Worker!=='function')return decodeVerifiedPreview(payload,signal);
  try {
    return await new Promise<DecodedPreview>((resolve,reject)=>{
      assertPreviewActive(signal);
      let worker:Worker;
      try{worker=new Worker(new URL('./attachment-preview.worker.ts',import.meta.url),{type:'module'});}
      catch(error){reject(error instanceof Error&&error.name==='AbortError'?error:new PreviewWorkerUnavailable('Não foi possível iniciar a preparação da prévia.'));return;}
      const cleanup=()=>{clearTimeout(timeout);signal.removeEventListener('abort',abort);worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;worker.terminate();};
      const abort=()=>{cleanup();reject(new DOMException('Prévia cancelada.','AbortError'));};
      const timeout=setTimeout(()=>{cleanup();reject(new PreviewWorkerUnavailable('A preparação da prévia não respondeu.'));},30_000);
      signal.addEventListener('abort',abort,{once:true});
      worker.onmessage=(event:MessageEvent<{ok:boolean;bytes:Uint8Array;dimensions:DecodedPreview['dimensions'];error?:string}>)=>{
        cleanup();
        if(event.data.ok)resolve({bytes:event.data.bytes,dimensions:event.data.dimensions});
        else reject(new Error(event.data.error||'Não foi possível abrir o arquivo.'));
      };
      worker.onerror=event=>{event.preventDefault();cleanup();reject(new PreviewWorkerUnavailable('Não foi possível iniciar a preparação da prévia.'));};
      worker.onmessageerror=()=>{cleanup();reject(new PreviewWorkerUnavailable('Não foi possível ler a prévia preparada.'));};
      try{worker.postMessage(payload);}catch(error){cleanup();reject(error instanceof Error&&error.name==='AbortError'?error:new PreviewWorkerUnavailable('Não foi possível enviar o arquivo para preparação da prévia.'));}
    });
  } catch(error) {
    assertPreviewActive(signal);
    // Older WebViews or restrictive readers can reject workers. Verification still
    // happens, in bounded tasks, without weakening the domain integrity checks.
    if(error instanceof PreviewWorkerUnavailable)return decodeVerifiedPreview(payload,signal);
    throw error;
  }
}

async function prepareBlob(payload:PreviewPayload,signal:AbortSignal):Promise<Blob> {
  const release=await takeTurn(signal);
  try {
    const {bytes,dimensions}=await decodeInWorker(payload,signal);
    await yieldPreview(signal);
    let blob=new Blob([new Uint8Array(bytes)],{type:payload.mime});
    if(payload.mime.startsWith('image/')){
      if(!dimensions||!dimensions.width||!dimensions.height)throw new Error('Não foi possível criar a prévia desta foto. Use Baixar original para recuperar o arquivo.');
      if(dimensions.width*dimensions.height>64_000_000||dimensions.width>20000||dimensions.height>20000)throw new Error('Esta foto é grande demais para a prévia. Use Baixar original para recuperar o arquivo.');
      if(Math.max(dimensions.width,dimensions.height)>1200){
        if(typeof createImageBitmap!=='function')throw new Error('Use Visualizar para abrir esta foto no leitor do aparelho.');
        const factor=1200/Math.max(dimensions.width,dimensions.height),width=Math.max(1,Math.round(dimensions.width*factor)),height=Math.max(1,Math.round(dimensions.height*factor));
        const bitmap=await createImageBitmap(blob,{resizeWidth:width,resizeHeight:height,resizeQuality:'high'});
        let canvas:HTMLCanvasElement|undefined;
        try{
          assertPreviewActive(signal);
          canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
          const context=canvas.getContext('2d');if(!context)throw new Error('Não foi possível preparar a prévia.');
          context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(bitmap,0,0,width,height);
          blob=await new Promise<Blob>((resolve,reject)=>canvas!.toBlob(value=>value?resolve(value):reject(new Error('Não foi possível preparar a prévia.')),'image/jpeg',0.8));
        }finally{bitmap.close();if(canvas){canvas.width=1;canvas.height=1;}}
      }
    }
    assertPreviewActive(signal);
    return blob;
  }finally{release();}
}

type PreviewEntry={payload:PreviewPayload;controller:AbortController;refs:number;promise:Promise<Blob>;cached:boolean;weight:number};
const entries=new Map<string,Set<PreviewEntry>>();
let cachedCount=0,cachedBytes=0;
const MAX_SHARED_PREVIEWS=8,MAX_SHARED_BYTES=8*1024*1024;

export type PreviewLease={blob:Promise<Blob>;release:()=>void};

/** Share verified work only while mounted views need it; no disk or idle cache. */
export function acquireAttachmentPreview(payload:PreviewPayload):PreviewLease {
  const key=`${payload.mime}:${payload.sha256}`;
  // A hash alone is insufficient: modified bytes with a retained hash must fail.
  let entry=[...(entries.get(key)||[])].find(candidate=>candidate.payload.base64===payload.base64);
  if(!entry){
    const controller=new AbortController(),snapshot={base64:payload.base64,mime:payload.mime,sha256:payload.sha256},weight=Math.ceil(payload.base64.length*3/4);
    const cached=cachedCount<MAX_SHARED_PREVIEWS&&cachedBytes+weight<=MAX_SHARED_BYTES;
    entry={payload:snapshot,controller,refs:0,promise:prepareBlob(snapshot,controller.signal),cached,weight};
    if(cached){const group=entries.get(key)||new Set<PreviewEntry>();group.add(entry);entries.set(key,group);cachedCount++;cachedBytes+=weight;}
  }
  entry.refs++;
  const selected=entry;
  let released=false;
  return {blob:selected.promise,release:()=>{
    if(released)return;released=true;selected.refs--;
    if(selected.refs)return;
    selected.controller.abort();
    if(selected.cached){const group=entries.get(key);group?.delete(selected);if(!group?.size)entries.delete(key);cachedCount--;cachedBytes-=selected.weight;}
  }};
}
