import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { Vault, decryptBytes, encryptBytes, fromBase64, toBase64, sha256, validateEnvelope, type BackupRecord, type BackupSummary, type Envelope } from '../src/lib/storage';

const password='senha-ficticia-desempenho';
const legacyDecode=(value:string)=>{
 if(value.length%4!==0||/[^A-Za-z0-9+/=]/.test(value))throw new Error('Arquivo codificado inválido.');
 const padding=value.endsWith('==')?2:value.endsWith('=')?1:0;
 if(value.slice(0,value.length-padding).includes('='))throw new Error('Arquivo codificado inválido.');
 try{return Uint8Array.from(atob(value),v=>v.charCodeAt(0));}catch{throw new Error('Arquivo codificado inválido.');}
};
const result=(fn:()=>Uint8Array)=>{try{return {bytes:Array.from(fn())};}catch(error){return {error:(error as Error).message};}};
const openDatabase=()=>new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('recanto-das-asas-private',2);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
async function seedBackups(rows:BackupRecord[]){const db=await openDatabase();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('backups','readwrite');for(const row of rows)tx.objectStore('backups').put(row);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
function legacyRetention(rows:BackupSummary[]){
 const keep=new Set<string>(),days=new Set<string>(),weeks=new Set<string>(),months=new Set<string>();
 for(const b of [...rows].sort((a,b)=>b.at.localeCompare(a.at))){if(b.pinned){keep.add(b.at);continue;}const date=new Date(b.at.slice(0,24)),day=b.at.slice(0,10),week=Math.floor(date.valueOf()/(7*86400000)).toString(),month=b.at.slice(0,7);if(!days.has(day)&&days.size<7){keep.add(b.at);days.add(day);}if(!weeks.has(week)&&weeks.size<4){keep.add(b.at);weeks.add(week);}if(!months.has(month)&&months.size<6){keep.add(b.at);months.add(month);}}
 return [...keep].sort();
}
beforeEach(()=>{Object.defineProperty(globalThis,'indexedDB',{value:new IDBFactory(),configurable:true});vi.restoreAllMocks();});

describe('compatibilidade da conversão e criptografia de backups grandes',()=>{
 it('preserves acceptance, rejected inputs and decoded bytes of the existing synchronous decoder',()=>{
  const cases=['','AA==','AB==','AAA=','AAB=','AAAA','////','++++','====','AAA','AAAA=','AAAA====','AA=A','A===','AA\n=','A A=','áAAA','____','----'];
  const alphabet=['A','B','/','+','=',' ','!','\n'];
  for(const a of alphabet)for(const b of alphabet)for(const c of alphabet)for(const d of alphabet)cases.push(a+b+c+d);
  for(const value of cases)expect(result(()=>fromBase64(value)),value).toEqual(result(()=>legacyDecode(value)));
  const bytes=new Uint8Array(257);for(let i=0;i<bytes.length;i++)bytes[i]=i%256;
  expect(fromBase64(toBase64(bytes))).toEqual(bytes);
 });
 it('decrypts the unchanged AES-GCM/PBKDF2 envelope and exports data accepted by standard WebCrypto',async()=>{
  const bytes=new Uint8Array(768*1024+2);for(let i=0;i<bytes.length;i++)bytes[i]=i%251;
  const envelope=await encryptBytes(bytes,password);
  expect(envelope.schemaVersion).toBe(1);expect(envelope.iterations).toBe(310000);expect(validateEnvelope(envelope)).toBe(envelope);
  const raw=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  const derived=await crypto.subtle.deriveKey({name:'PBKDF2',salt:fromBase64(envelope.salt).buffer as ArrayBuffer,iterations:envelope.iterations,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(envelope.iv).buffer as ArrayBuffer},derived,fromBase64(envelope.ciphertext).buffer as ArrayBuffer);
  expect(new Uint8Array(plain)).toEqual(bytes);
  // A legacy producer uses one standard Base64 call, including final padding.
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv:fromBase64(envelope.iv).buffer as ArrayBuffer},derived,bytes);
  const legacyEnvelope={...envelope,ciphertext:toBase64(new Uint8Array(encrypted))};
  expect(await decryptBytes(legacyEnvelope,password)).toEqual(bytes);
  for(const count of [768*1024,768*1024+1]){const sample=bytes.subarray(0,count),padded=await encryptBytes(sample,password);expect(padded.ciphertext.endsWith(count%3===0?'==':'=')).toBe(true);expect(await decryptBytes(padded,password)).toEqual(sample);}
  await expect(decryptBytes(envelope,'senha-incorreta')).rejects.toThrow('Senha incorreta ou arquivo danificado.');
 },20000);
 it('keeps the SHA-256 snapshot when the caller changes a large source after hashing starts',async()=>{
  const bytes=new Uint8Array(512*1024).fill(73),expected=await sha256(bytes),pending=sha256(bytes);bytes.fill(91);expect(await pending).toBe(expected);expect(await sha256(bytes)).not.toBe(expected);
 });
 it('validates each ciphertext byte once and yields between large decode blocks',async()=>{
  const envelope=await encryptBytes(new Uint8Array(768*1024+1).fill(173),password);
  const original=globalThis.atob;let characters=0,largeCalls=0,heartbeat=false,continuedAfterHeartbeat=false;
  const spy=vi.spyOn(globalThis,'atob').mockImplementation(value=>{characters+=value.length;if(value.length>100000){largeCalls++;if(largeCalls===1)setTimeout(()=>{heartbeat=true;},0);else continuedAfterHeartbeat ||= heartbeat;}return original(value);});
  try{expect((await decryptBytes(envelope,password)).length).toBe(768*1024+1);expect(characters).toBe(envelope.salt.length+envelope.iv.length+envelope.ciphertext.length);expect(continuedAfterHeartbeat).toBe(true);}finally{spy.mockRestore();}
 });
 it('preserves envelope validation errors, including misplaced padding across block boundaries',async()=>{
  const base=await encryptBytes(new Uint8Array(512*1024).fill(9),password);
  const malformed:unknown[]=[null,{}, {...base,schemaVersion:2},{...base,iterations:99999},{...base,iterations:2000001},{...base,salt:'AA=='},{...base,iv:'AAAA'},{...base,ciphertext:'AA=='},{...base,ciphertext:'A'.repeat(262143)+'='+base.ciphertext.slice(262144)},{...base,ciphertext:base.ciphertext.slice(0,-1)+'!'},{...base,ciphertext:base.ciphertext.slice(1)}];
  for(const value of malformed){let message='';try{validateEnvelope(value);}catch(error){message=(error as Error).message;}expect(message).not.toBe('');await expect(decryptBytes(value,password)).rejects.toThrow(message);}
  const tampered={...base,ciphertext:(base.ciphertext[0]==='A'?'B':'A')+base.ciphertext.slice(1)};
  await expect(decryptBytes(tampered,password)).rejects.toThrow('Senha incorreta ou arquivo danificado.');
 });
});

describe('metadados e retenção das cópias locais sem carregar todos os envelopes',()=>{
 it('lists only summaries, reads the selected envelope and keeps the legacy backups API',async()=>{
  const vault=new Vault();await vault.create(password);const envelope=await vault.exportEnvelope();
  const records:BackupRecord[]=[{at:'2026-10-01T00:00:00.000Z-a',hash:'a'.repeat(64),size:100,pinned:true,envelope},{at:'2026-10-02T00:00:00.000Z-b',hash:'b'.repeat(64),size:200,envelope}];
  await seedBackups(records);
  const getAll=vi.spyOn(IDBObjectStore.prototype,'getAll').mockImplementation(()=>{throw new Error('getAll não deve ser usado na lista ou retenção.');});
  try{const summaries=await vault.backupSummaries();expect(summaries).toEqual(records.map(({envelope:_,...record})=>({...record,pinned:record.pinned})));expect(summaries.every(row=>!('envelope' in row))).toBe(true);expect(await vault.readBackup(records[0].at)).toEqual(records[0]);expect(await vault.readBackup('ausente')).toBeUndefined();}finally{getAll.mockRestore();}
  expect(await vault.backups()).toEqual(records);
  vault.lock();await expect(vault.backupSummaries()).rejects.toThrow('Desbloqueie a base privada.');await expect(vault.readBackup(records[0].at)).rejects.toThrow('Desbloqueie a base privada.');
 });
 it('retains exactly the same daily, weekly, monthly and pinned copies across dates and ties',async()=>{
  const vault=new Vault();await vault.create(password);const envelope:Envelope=await vault.exportEnvelope();
  const rows:BackupRecord[]=[];
  for(let i=0;i<420;i++){const date=new Date(Date.UTC(2025,7,1)+i*86400000);for(let j=0;j<(i%19===0?3:1);j++)rows.push({at:date.toISOString()+'-'+j,hash:String(i)+'-'+j,size:i+100,pinned:i%37===0,envelope});}
  await seedBackups(rows);
  const getAll=vi.spyOn(IDBObjectStore.prototype,'getAll').mockImplementation(()=>{throw new Error('getAll não deve ser usado na retenção.');});
  try{await vault.retainBackup(envelope,'cópia-nova',500);const result=await vault.backupSummaries(),added=result.find(row=>row.hash==='cópia-nova');expect(added).toBeDefined();expect(result.map(row=>row.at).sort()).toEqual(legacyRetention([...rows,added!]));expect(result.filter(row=>row.pinned).map(row=>row.at).sort()).toEqual(rows.filter(row=>row.pinned).map(row=>row.at).sort());for(const row of result)expect(await vault.readBackup(row.at)).toEqual(row.at===added!.at?{...added,envelope}:rows.find(original=>original.at===row.at));}finally{getAll.mockRestore();}
 },20000);
});
