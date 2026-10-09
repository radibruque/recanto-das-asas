import { Capacitor, registerPlugin } from '@capacitor/core';
import { bytesToBase64, sha256 } from '../domain/documents';

type NativeFiles = {
  beginFile(options:{name:string;mime:string;size:number;sha256:string}):Promise<{id:string}>;
  appendFile(options:{id:string;index:number;base64:string}):Promise<void>;
  finishFile(options:{id:string}):Promise<void>;
  saveStaged(options:{id:string}):Promise<{cancelled:boolean}>;
  openStaged(options:{id:string}):Promise<void>;
  shareStaged(options:{id:string}):Promise<void>;
  printStaged(options:{id:string}):Promise<void>;
  discardFile(options:{id:string}):Promise<void>;
};
const files=registerPlugin<NativeFiles>('RecantoFiles');
export const isNativeAndroid=()=>Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='android';
const CHUNK_BYTES=192*1024;

async function prepare(bytes:Uint8Array,name:string,mime:string):Promise<string>{
  if(bytes.byteLength<1)throw new Error('O arquivo está vazio. Nenhum destino foi aberto.');
  if(bytes.byteLength>64*1024*1024)throw new Error('A exportação no Android aceita arquivos de até 64 MB.');
  const {id}=await files.beginFile({name,mime,size:bytes.byteLength,sha256:sha256(bytes)});
  try{
    for(let offset=0,index=0;offset<bytes.byteLength;offset+=CHUNK_BYTES,index++){
      await files.appendFile({id,index,base64:bytesToBase64(bytes.subarray(offset,offset+CHUNK_BYTES))});
    }
    await files.finishFile({id});
    return id;
  }catch(error){await files.discardFile({id}).catch(()=>{});throw error;}
}
export async function androidExport(bytes:Uint8Array,name:string,mime:string,action:'save'|'view'|'share'|'print'='save'):Promise<void>{
  const id=await prepare(bytes,name,mime);
  try{
    if(action==='view')await files.openStaged({id});
    else if(action==='share')await files.shareStaged({id});
    else if(action==='print')await files.printStaged({id});
    else {const result=await files.saveStaged({id});if(result.cancelled)throw new Error('Salvamento cancelado. Nenhum arquivo foi gravado.');}
  }catch(error){await files.discardFile({id}).catch(()=>{});throw error;}
}
