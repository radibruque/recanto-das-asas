import { decodeVerifiedPreview, type PreviewPayload } from './attachment-preview-data';

const scope=globalThis as unknown as {onmessage:(event:MessageEvent<PreviewPayload>)=>void;postMessage:(value:unknown,transfer?:Transferable[])=>void};
scope.onmessage=event=>{
  void decodeVerifiedPreview(event.data,undefined,false).then(result=>{
    scope.postMessage({ok:true,...result},[result.bytes.buffer as ArrayBuffer]);
  }).catch(error=>scope.postMessage({ok:false,error:error instanceof Error?error.message:'Não foi possível abrir o arquivo.'}));
};
