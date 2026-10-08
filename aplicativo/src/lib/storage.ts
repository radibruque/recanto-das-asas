import { emptyState, type State } from '../domain/types';
import { validateState } from './validation';

export type Envelope = {schemaVersion:1;salt:string;iv:string;ciphertext:string;iterations:number};
export type SyncConfig = {url:string;workspaceId:string;token:string;remoteRevision:number;lastSyncAt:string};
export type QueueItem = {operationId:string;envelope:Envelope;expectedRevision?:number};
type Metadata = {sync:SyncConfig|null;queue:QueueItem[]};
type RecordValue = {key:'vault';revision:number;envelope:Envelope;metadata:Envelope};
const iterations = 310000;
export function toBase64(bytes:Uint8Array):string {let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
export function fromBase64(value:string):Uint8Array {if(value.length%4!==0||/[^A-Za-z0-9+/=]/.test(value))throw new Error('Arquivo codificado inválido.');const padding=value.endsWith('==')?2:value.endsWith('=')?1:0;if(value.slice(0,value.length-padding).includes('='))throw new Error('Arquivo codificado inválido.');try{return Uint8Array.from(atob(value),v=>v.charCodeAt(0));}catch{throw new Error('Arquivo codificado inválido.');}}
function buffer(bytes:Uint8Array):ArrayBuffer{return bytes.slice().buffer as ArrayBuffer;}
async function key(password:string,salt:Uint8Array,count:number){
 const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt:buffer(salt),iterations:count,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function encryptBytes(bytes:Uint8Array,password:string):Promise<Envelope>{
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv:buffer(iv)},await key(password,salt,iterations),buffer(bytes));
 return {schemaVersion:1,salt:toBase64(salt),iv:toBase64(iv),ciphertext:toBase64(new Uint8Array(encrypted)),iterations};
}
export function validateEnvelope(value:unknown):Envelope {
 if(!value||typeof value!=='object')throw new Error('Arquivo criptografado inválido.');
 const e=value as Envelope;
 if(e.schemaVersion!==1||!Number.isInteger(e.iterations)||e.iterations<100000||e.iterations>2000000||typeof e.salt!=='string'||typeof e.iv!=='string'||typeof e.ciphertext!=='string'||e.ciphertext.length>180000000)throw new Error('Versão ou tamanho do arquivo incompatível.');
 if(fromBase64(e.salt).length!==16||fromBase64(e.iv).length!==12||fromBase64(e.ciphertext).length<16)throw new Error('Arquivo criptografado inválido.');
 return e;
}
export async function decryptBytes(value:unknown,password:string):Promise<Uint8Array>{
 const e=validateEnvelope(value);
 try {return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:buffer(fromBase64(e.iv))},await key(password,fromBase64(e.salt),e.iterations),buffer(fromBase64(e.ciphertext))));}
 catch {throw new Error('Senha incorreta ou arquivo danificado.');}
}
export const encryptObject=(value:unknown,password:string)=>encryptBytes(new TextEncoder().encode(JSON.stringify(value)),password);
export async function decryptObject(e:unknown,password:string):Promise<unknown>{try{return JSON.parse(new TextDecoder().decode(await decryptBytes(e,password)));}catch(error){if(error instanceof SyntaxError)throw new Error('Conteúdo do arquivo inválido.');throw error;}}
export async function sha256(bytes:Uint8Array):Promise<string>{return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer(bytes))),x=>x.toString(16).padStart(2,'0')).join('');}
function request<T>(req:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function done(tx:IDBTransaction):Promise<void>{return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('Alteração não gravada.'));});}
async function database():Promise<IDBDatabase>{const req=indexedDB.open('recanto-das-asas-private',2);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('vault'))req.result.createObjectStore('vault',{keyPath:'key'});if(!req.result.objectStoreNames.contains('backups'))req.result.createObjectStore('backups',{keyPath:'at'});};return request(req);}
export class Vault {
 private password=''; private db:IDBDatabase|null=null;
 async exists(){this.db??=await database();return !!await this.read();}
 private async read():Promise<RecordValue|undefined>{this.db??=await database();return request(this.db.transaction('vault','readonly').objectStore('vault').get('vault'));}
 private async replace(next:RecordValue,expected:number|null){
  this.db??=await database();const tx=this.db.transaction('vault','readwrite');const complete=done(tx);const store=tx.objectStore('vault');
  const req=store.get('vault');req.onsuccess=()=>{const old=req.result as RecordValue|undefined;if((expected===null&&old)||(expected!==null&&old?.revision!==expected)){tx.abort();return;}store.put(next);};
  try{await complete;}catch {throw new Error('Outro acesso alterou os registros. Atualize a tela e tente novamente; seus campos foram preservados.');}
 }
 async create(password:string){if(password.length<10)throw new Error('Use uma senha com pelo menos 10 caracteres.');const state=emptyState();await this.replace({key:'vault',revision:0,envelope:await encryptObject(state,password),metadata:await encryptObject({sync:null,queue:[]},password)},null);this.password=password;return state;}
 async unlock(password:string){const rec=await this.read();if(!rec)throw new Error('Crie a base privada primeiro.');const state=validateState(await decryptObject(rec.envelope,password));this.password=password;return state;}
 lock(){this.password='';}
 private check(){if(!this.password)throw new Error('Desbloqueie a base privada.');}
 async load(){this.check();const rec=await this.read();if(!rec)throw new Error('Base ausente.');return validateState(await decryptObject(rec.envelope,this.password));}
 async metadata():Promise<Metadata&{localRevision:number}>{this.check();const rec=await this.read();if(!rec)throw new Error('Base ausente.');const meta=await decryptObject(rec.metadata,this.password) as Metadata;return {...meta,localRevision:rec.revision};}
 async saveMetadata(change:(meta:Metadata)=>void){this.check();for(let i=0;i<4;i++){const rec=await this.read();if(!rec)throw new Error('Base ausente.');const meta=await decryptObject(rec.metadata,this.password) as Metadata;change(meta);const next={...rec,revision:rec.revision+1,metadata:await encryptObject(meta,this.password)};try{await this.replace(next,rec.revision);return;}catch(error){if(i===3)throw error;}}}
 async mutate(change:(state:State)=>string|undefined,expectedLocalRevision?:number){
  this.check();for(let attempt=0;attempt<4;attempt++){
   const rec=await this.read();if(!rec)throw new Error('Base ausente.');if(expectedLocalRevision!==undefined&&rec.revision!==expectedLocalRevision)throw new Error('A base mudou durante a revisão. Verifique novamente antes de substituir.');const state=validateState(await decryptObject(rec.envelope,this.password));const result=change(state);state.revision++;
   validateState(state);const envelope=await encryptObject(state,this.password);const meta=await decryptObject(rec.metadata,this.password) as Metadata;
   if(meta.sync){const item={operationId:crypto.randomUUID(),envelope};meta.queue=meta.queue.length?[meta.queue[0],item]:[item];}
   try{await this.replace({key:'vault',revision:rec.revision+1,envelope,metadata:await encryptObject(meta,this.password)},rec.revision);return {state,id:result};}catch(error){if(attempt===3||expectedLocalRevision!==undefined)throw error;}
  }throw new Error('Não foi possível gravar.');
 }
 async exportEnvelope(){this.check();const rec=await this.read();if(!rec)throw new Error('Base ausente.');return rec.envelope;}
 async decodeState(envelope:Envelope){this.check();return validateState(await decryptObject(envelope,this.password));}
 async adopt(envelope:Envelope,remoteRevision:number,expectedLocalRevision:number,allowPending=false){
  this.check();const rec=await this.read();if(!rec)throw new Error('Base ausente.');if(rec.revision!==expectedLocalRevision)throw new Error('A base mudou durante a revisão. Repita a sincronização antes de escolher.');const incoming=await this.decodeState(envelope);const meta=await decryptObject(rec.metadata,this.password) as Metadata;if(meta.queue.length&&!allowPending)throw new Error('Há alterações locais pendentes. Revise o conflito antes de substituir.');
  if(meta.sync){meta.sync.remoteRevision=remoteRevision;meta.sync.lastSyncAt=new Date().toISOString();}meta.queue=[];
  await this.replace({key:'vault',revision:rec.revision+1,envelope,metadata:await encryptObject(meta,this.password)},rec.revision);return incoming;
 }
 async queueCurrent(remoteRevision?:number){this.check();for(let i=0;i<4;i++){const rec=await this.read();if(!rec)throw new Error('Base ausente.');const meta=await decryptObject(rec.metadata,this.password) as Metadata;if(!meta.sync)throw new Error('Configure a sincronização.');if(remoteRevision!==undefined)meta.sync.remoteRevision=remoteRevision;const item={operationId:crypto.randomUUID(),envelope:rec.envelope};meta.queue=remoteRevision!==undefined?[item]:meta.queue.length?[meta.queue[0],item]:[item];try{await this.replace({...rec,revision:rec.revision+1,metadata:await encryptObject(meta,this.password)},rec.revision);return;}catch(error){if(i===3)throw error;}}}
 async prepareUpload(operationId:string,config:SyncConfig){let result:QueueItem|undefined;await this.saveMetadata(meta=>{if(meta.sync?.url!==config.url||meta.sync?.workspaceId!==config.workspaceId||meta.sync?.token!==config.token)throw new Error('A conexão mudou; repita a sincronização.');const item=meta.queue.find(q=>q.operationId===operationId);result=undefined;if(item){item.expectedRevision??=meta.sync.remoteRevision;result={...item};}});return result;}
 async acknowledge(operationId:string,revision:number,config:SyncConfig){await this.saveMetadata(meta=>{if(meta.sync?.url!==config.url||meta.sync?.workspaceId!==config.workspaceId||meta.sync?.token!==config.token)throw new Error('A conexão mudou durante a sincronização.');if(!meta.queue.some(q=>q.operationId===operationId))throw new Error('A fila mudou durante a sincronização. Repita a conexão.');meta.sync.remoteRevision=revision;meta.sync.lastSyncAt=new Date().toISOString();meta.queue=meta.queue.filter(q=>q.operationId!==operationId);});}
 async encryptBackup(bytes:Uint8Array){this.check();return encryptBytes(bytes,this.password);}
 async decryptBackup(envelope:unknown){this.check();return decryptBytes(envelope,this.password);}
 async restore(state:State,expectedLocalRevision?:number){validateState(state);return this.mutate(current=>{const revision=current.revision;Object.assign(current,state,{revision});return undefined;},expectedLocalRevision);}
 async retainBackup(envelope:Envelope,hash:string,size:number,pinned=false){this.check();this.db??=await database();const all=await request(this.db.transaction('backups','readonly').objectStore('backups').getAll()) as {at:string;envelope:Envelope;hash:string;size:number;pinned?:boolean}[];const at=new Date().toISOString()+'-'+crypto.randomUUID().slice(0,8);all.push({at,envelope,hash,size,pinned});all.sort((a,b)=>b.at.localeCompare(a.at));const keep=new Set<string>();const days=new Set<string>(),weeks=new Set<string>(),months=new Set<string>();for(const b of all){if(b.pinned){keep.add(b.at);continue;}const date=new Date(b.at.slice(0,24));const day=b.at.slice(0,10),week=Math.floor(date.valueOf()/(7*86400000)).toString(),month=b.at.slice(0,7);if(!days.has(day)&&days.size<7){keep.add(b.at);days.add(day);}if(!weeks.has(week)&&weeks.size<4){keep.add(b.at);weeks.add(week);}if(!months.has(month)&&months.size<6){keep.add(b.at);months.add(month);}}const tx=this.db.transaction('backups','readwrite');const complete=done(tx);const store=tx.objectStore('backups');store.put({at,envelope,hash,size,pinned});for(const b of all)if(!keep.has(b.at))store.delete(b.at);await complete;}
 async backups(){this.check();this.db??=await database();return await request(this.db.transaction('backups','readonly').objectStore('backups').getAll()) as {at:string;envelope:Envelope;hash:string;size:number}[];}
}
