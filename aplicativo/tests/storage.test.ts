import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import JSZip from 'jszip';
import { Vault, encryptObject, decryptObject, encryptBytes, decryptBytes, fromBase64, toBase64, sha256 } from '../src/lib/storage';
import { emptyState } from '../src/domain/types';
import { applyCommand } from '../src/domain/engine';
import { validateState } from '../src/lib/validation';
import { createBackup, inspectBackup } from '../src/lib/backup';
import { documentsHandler } from '../src/domain/documents';
import { today } from '../src/domain/shared';
const password='senha-ficticia-de-teste';
const bird=(identification='T-001')=>({identification,name:'João',species:'Calopsita',sex:'macho',mutation:'Cinza',certainty:'observada',origin:'Teste fictício',status:'disponível'});
beforeEach(()=>{Object.defineProperty(globalThis,'indexedDB',{value:new IDBFactory(),configurable:true});});
describe('base privada e transações',()=>{
 it('encrypts locally, survives a new vault instance and rejects a wrong password',async()=>{const a=new Vault();expect(await a.exists()).toBe(false);await a.create(password);await a.mutate(s=>applyCommand(s,'real','saveBird',bird()));a.lock();await expect(a.load()).rejects.toThrow(/Desbloqueie/);const b=new Vault();await expect(b.unlock('senha-incorreta')).rejects.toThrow(/Senha incorreta/);const loaded=await b.unlock(password);expect(loaded.birds[0].name).toBe('João');expect(JSON.stringify(await b.exportEnvelope())).not.toContain('João');});
 it('preserves concurrent changes from two accesses without last-writer data loss',async()=>{const a=new Vault(),b=new Vault();await a.create(password);await b.unlock(password);await Promise.all([a.mutate(s=>applyCommand(s,'real','saveBird',bird('T-001'))),b.mutate(s=>applyCommand(s,'real','saveBird',bird('T-002')))]);const result=await a.load();expect(result.birds.map(b=>b.identification).sort()).toEqual(['T-001','T-002']);expect(result.revision).toBe(2);});
 it('rejects simultaneous duplicate identification, leaves exactly one record and no partial history',async()=>{const a=new Vault(),b=new Vault();await a.create(password);await b.unlock(password);const result=await Promise.allSettled([a.mutate(s=>applyCommand(s,'real','saveBird',bird())),b.mutate(s=>applyCommand(s,'real','saveBird',bird()))]);expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);const state=await a.load();expect(state.birds).toHaveLength(1);expect(state.mutations).toHaveLength(1);expect(state.audit).toHaveLength(1);});
 it('imports parent links transactionally and rejects a failed/circular import without partial records',async()=>{const vault=new Vault();await vault.create(password);const header='identificacao;nome;especie;sexo;mutacao;origem;nascimento;pai;mae\n';await vault.mutate(s=>applyCommand(s,'real','birds.import',{csv:header+'PAI;Pai;Calopsita;macho;Cinza;Teste;2024-01-01;;\nFILHO;Filho;Calopsita;indeterminado;Cinza;Teste;2025-01-01;PAI;\n'}));const state=await vault.load();expect(state.birds.find(b=>b.identification==='FILHO')?.fatherId).toBe(state.birds.find(b=>b.identification==='PAI')?.id);await expect(vault.mutate(s=>applyCommand(s,'real','birds.import',{csv:header+'BAD;Bad;Calopsita;macho;Cinza;Teste;2025-02-30;;'}))).rejects.toThrow();expect((await vault.load()).birds).toHaveLength(2);});
 it('cannot seed production and keeps the real base empty when demo examples are created',async()=>{const vault=new Vault();await vault.create(password);await expect(vault.mutate(s=>applyCommand(s,'real','initializeDemo',{}))).rejects.toThrow();await vault.mutate(s=>applyCommand(s,'demo','initializeDemo',{}));expect((await vault.load()).birds.filter(b=>b.scope==='real')).toHaveLength(0);expect((await vault.load()).birds.filter(b=>b.scope==='demo')).toHaveLength(3);});
});
describe('criptografia, backup e restauração',()=>{
 it('round trips a large encrypted binary without stack overflow and detects authentication tampering',async()=>{const bytes=new Uint8Array(8*1024*1024).fill(123);const encoded=toBase64(bytes);expect(await sha256(fromBase64(encoded))).toBe(await sha256(bytes));const envelope=await encryptBytes(bytes,password);expect(await sha256(await decryptBytes(envelope,password))).toBe(await sha256(bytes));envelope.ciphertext=(envelope.ciphertext[0]==='A'?'B':'A')+envelope.ciphertext.slice(1);await expect(decryptBytes(envelope,password)).rejects.toThrow(/danificado/);},20000);
 it('backs up all state, attachment bytes, settings and art originals, validates hashes and restores cleanly',async()=>{const state=emptyState();applyCommand(state,'real','saveBird',bird());const attachmentBytes=new TextEncoder().encode('Laudo fictício — João');documentsHandler(state,'real','attachment.add',{title:'Laudo',category:'Exame',date:'2026-01-01',birdId:state.birds[0].id,fileName:'laudo.txt',mime:'text/plain',size:attachmentBytes.length,base64:toBase64(attachmentBytes),sha256:await sha256(attachmentBytes)});const artBytes=new TextEncoder().encode('original fictício');const art={path:'Teste/original.txt',name:'original.txt',category:'Teste',mime:'text/plain',size:artBytes.length,sha256:await sha256(artBytes)};const zipBytes=await createBackup(state,[art],async()=>artBytes);const encrypted=await encryptBytes(zipBytes,password),restored=await inspectBackup(await decryptBytes(encrypted,password));expect(restored.state.attachments[0].base64).toBe(toBase64(attachmentBytes));expect(restored.arts).toBe(1);const vault=new Vault();await vault.create(password);await vault.restore(restored.state);expect((await vault.load()).birds[0].identification).toBe('T-001');const zip=await JSZip.loadAsync(zipBytes);zip.file('database.json','{}');await expect(inspectBackup(await zip.generateAsync({type:'uint8array'}))).rejects.toThrow(/integridade/);});
 it('preserves both pinned conflict snapshots even when they are created on the same day',async()=>{const vault=new Vault();await vault.create(password);const e=await vault.exportEnvelope();await vault.retainBackup(e,'a'.repeat(64),100,true);await vault.retainBackup(e,'b'.repeat(64),100,true);await vault.retainBackup(e,'c'.repeat(64),100);expect((await vault.backups()).map(b=>b.hash)).toEqual(expect.arrayContaining(['a'.repeat(64),'b'.repeat(64),'c'.repeat(64)]));});
 it('rejects missing and cross-scope links, negative currency and unsupported versions before restoration',()=>{const s=emptyState();applyCommand(s,'real','saveBird',bird());s.birds[0].fatherId='missing';expect(()=>validateState(s)).toThrow(/vínculos/);s.birds[0].fatherId=null;s.birds[0].acquisitionCents=-1;expect(()=>validateState(s)).toThrow(/inválida/);s.birds[0].acquisitionCents=0;s.schemaVersion=4 as 3;expect(()=>validateState(s)).toThrow(/inválida/);});
});

describe('substituição revisada da base',()=>{
 it('rejects restoration if a concurrent write occurred after the reviewed backup baseline',async()=>{
  const a=new Vault(),b=new Vault();await a.create(password);await b.unlock(password);const baseline=await a.metadata();
  await b.mutate(s=>applyCommand(s,'real','saveBird',bird('PRESERVADA')));
  await expect(a.restore(emptyState(),baseline.localRevision)).rejects.toThrow(/mudou durante/);
  expect((await a.load()).birds[0].identification).toBe('PRESERVADA');
 });
 it('keeps the local state revision increasing on a confirmed restore',async()=>{
  const vault=new Vault();await vault.create(password);await vault.mutate(s=>applyCommand(s,'real','saveBird',bird()));
  const baseline=await vault.metadata();const restored=await vault.restore(emptyState(),baseline.localRevision);
  expect(restored.state.revision).toBe(2);expect(restored.state.birds).toHaveLength(0);
 });
});

describe('reserva concorrente de uma ave',()=>{
 it('commits exactly one active sale and one installment when two accesses reserve simultaneously',async()=>{
  const a=new Vault(),b=new Vault();await a.create(password);
  await a.mutate(s=>applyCommand(s,'real','saveBird',bird('AVE-UNICA')));await a.mutate(s=>applyCommand(s,'real','contact.save',{kind:'cliente',name:'Cliente fictício'}));await b.unlock(password);
  const state=await a.load();const sale={contactId:state.contacts[0].id,date:today(),status:'reservada',items:[{kind:'ave',refId:state.birds[0].id,description:'Ave de teste',quantity:1,unitCents:10000}]};
  const results=await Promise.allSettled([a.mutate(s=>applyCommand(s,'real','sale.save',sale)),b.mutate(s=>applyCommand(s,'real','sale.save',sale))]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);const current=await a.load();expect(current.sales).toHaveLength(1);expect(current.bills).toHaveLength(1);expect(current.birds[0].status).toBe('reservado');
 });
});
