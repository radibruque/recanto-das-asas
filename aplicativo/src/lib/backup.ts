import JSZip from 'jszip';
import type { ArtFile, State } from '../domain/types';
import { sha256, fromBase64 } from './storage';
import { verifyFile } from '../domain/documents';
import { validateState } from './validation';
type Manifest = {format:'recanto-backup';version:1;createdAt:string;files:{path:string;sha256:string;size:number}[]};
export async function createBackup(state:State,arts:ArtFile[],load:(path:string)=>Promise<Uint8Array>):Promise<Uint8Array>{
 validateState(state);const zip=new JSZip();const manifest:Manifest={format:'recanto-backup',version:1,createdAt:new Date().toISOString(),files:[]};
 async function add(path:string,bytes:Uint8Array){zip.file(path,bytes);manifest.files.push({path,sha256:await sha256(bytes),size:bytes.length});}
 await add('database.json',new TextEncoder().encode(JSON.stringify(state)));
 for(const art of arts){if(!safePath(art.path))throw new Error('Caminho de arte inválido.');const bytes=await load(art.path);if(await sha256(bytes)!==art.sha256||bytes.length!==art.size)throw new Error('Arte danificada: '+art.name);await add('artes/'+art.path,bytes);}
 await add('artes/catalog.json',new TextEncoder().encode(JSON.stringify(arts)));
 zip.file('manifest.json',JSON.stringify(manifest));
 return zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6}});
}
const safePath=(path:string)=>path.length<500&&!path.startsWith('/')&&!path.includes('\\')&&!path.split('/').some(v=>v==='..'||v==='.'||!v);
export async function inspectBackup(bytes:Uint8Array):Promise<{state:State;createdAt:string;arts:number;zip:JSZip}>{
 if(bytes.length>150*1024*1024)throw new Error('Backup acima do limite de 150 MB.');
 let zip:JSZip;try{zip=await JSZip.loadAsync(bytes,{checkCRC32:true});}catch{throw new Error('Backup corrompido.');}
 const manifestFile=zip.file('manifest.json');if(!manifestFile)throw new Error('Manifesto do backup ausente.');
 const manifest=JSON.parse(await manifestFile.async('string')) as Manifest;
 if(manifest.format!=='recanto-backup'||manifest.version!==1||!Array.isArray(manifest.files)||manifest.files.length>10000)throw new Error('Versão do backup incompatível.');
 const expected=new Set<string>(['manifest.json']);let total=0;
 for(const f of manifest.files){if(!safePath(f.path)||expected.has(f.path)||!Number.isSafeInteger(f.size)||f.size<0||!/^([a-f0-9]{64})$/.test(f.sha256))throw new Error('Manifesto inválido.');expected.add(f.path);total+=f.size;if(total>150*1024*1024)throw new Error('Backup descompactado acima do limite.');const file=zip.file(f.path);if(!file)throw new Error('Arquivo ausente: '+f.path);const content=await file.async('uint8array');if(content.length!==f.size||await sha256(content)!==f.sha256)throw new Error('Falha de integridade: '+f.path);}
 for(const [name,file] of Object.entries(zip.files))if(!file.dir&&!expected.has(name))throw new Error('Conteúdo inesperado no backup.');
 const db=zip.file('database.json');if(!db)throw new Error('Banco ausente no backup.');const state=validateState(JSON.parse(await db.async('string')));
 for(const file of [...state.attachments,...state.documents]){const content=fromBase64(file.base64);if(file.size!==content.length||await sha256(content)!==file.sha256)throw new Error('Anexo ou documento danificado: '+file.fileName);verifyFile(content,file.mime,file.fileName,'createdAt' in file);}
 const catalog=zip.file('artes/catalog.json');if(!catalog)throw new Error('Catálogo de artes ausente.');
 const arts=JSON.parse(await catalog.async('string')) as ArtFile[];
 if(!Array.isArray(arts)||arts.some(a=>!expected.has('artes/'+a.path)))throw new Error('Artes incompletas no backup.');
 return {state,createdAt:manifest.createdAt,arts:arts.length,zip};
}
