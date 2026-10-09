import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/domain/engine';
import { emptyState } from '../src/domain/types';
import { bytesToBase64, sha256 } from '../src/domain/documents';
import { validateState } from '../src/lib/validation';

const bird={identification:'TX-001',name:'Ave de teste',species:'Calopsita',sex:'macho',mutation:'Cinza',certainty:'informada',origin:'Cadastro',status:'manejo'};
const file=(name='exame.txt')=>{
 const bytes=new TextEncoder().encode('Exame e observações revisadas');
 return {fileName:name,mime:'text/plain',size:bytes.length,base64:bytesToBase64(bytes),sha256:sha256(bytes),title:'Exame',category:'Saúde',date:'2026-01-01',issuer:'',reference:'',validUntil:'',notes:'',shareWithCustomer:false};
};
describe('cadastros e anexos na mesma transação',()=>{
 it('links a new bird and files in one command and validates the complete saved state',()=>{
  const state=emptyState();const id=applyCommand(state,'real','save.withAttachments',{action:'saveBird',data:bird,attachments:[file()]});
  expect(state.birds).toHaveLength(1);expect(state.attachments[0]).toMatchObject({birdId:id,sourceType:'bird',sourceId:id});
  expect(validateState(state).attachments[0].base64).toBe(file().base64);
 });
 it('leaves no bird, audit or first attachment when the second file fails integrity',()=>{
  const state=emptyState(),before=structuredClone(state);
  expect(()=>applyCommand(state,'real','save.withAttachments',{action:'saveBird',data:bird,attachments:[file(),{...file('segundo.txt'),sha256:'0'.repeat(64)}]})).toThrow(/integridade/);
  expect(state).toEqual(before);
 });
 it('preserves an existing bird when a new file or parent update fails',()=>{
  const state=emptyState(),id=applyCommand(state,'real','saveBird',bird)!;const before=structuredClone(state);
  expect(()=>applyCommand(state,'real','save.withAttachments',{action:'saveBird',data:{...state.birds[0],name:'Mudança'},attachments:[{...file(),size:0}]})).toThrow();
  expect(state).toEqual(before);
  expect(()=>applyCommand(state,'real','save.withAttachments',{action:'saveBird',data:{...bird,identification:'TX-001'},attachments:[file()]})).toThrow(/identificação/);
  expect(state).toEqual(before);expect(state.birds[0].id).toBe(id);
 });
 it('links direct health files to both bird and health history and respects scope',()=>{
  const state=emptyState(),birdId=applyCommand(state,'real','saveBird',bird)!;
  const data={birdId,date:'2026-01-01',kind:'exame',title:'Consulta',notes:'Observação',weightGrams:100,professional:'Clínica',author:'Responsável',attachmentIds:[]};
  const healthId=applyCommand(state,'real','save.withAttachments',{action:'saveHealth',data,attachments:[file()]});
  expect(state.health[0].attachmentIds).toEqual([state.attachments[0].id]);
  expect(state.attachments[0]).toMatchObject({birdId,sourceType:'health',sourceId:healthId});
  expect(()=>applyCommand(state,'demo','save.withAttachments',{action:'saveHealth',data,attachments:[file()]})).toThrow();
  expect(state.health).toHaveLength(1);expect(validateState(state).health).toHaveLength(1);
 });
 it('assigns the principal photo without losing previous photos or booklet data',()=>{
  const state=emptyState(),birdId=applyCommand(state,'real','saveBird',bird)!;
  const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ9sAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
  const photo={...file(),fileName:'ave.png',mime:'image/png',base64:bytesToBase64(bytes),size:bytes.length,sha256:sha256(bytes),role:'photo'};
  applyCommand(state,'real','save.withAttachments',{action:'bird.booklet',data:{id:birdId,booklet:{currentDiet:'Alimentação revisada'}},attachments:[photo]});
  const first=state.birds[0].photoId;
  applyCommand(state,'real','save.withAttachments',{action:'bird.booklet',data:{id:birdId,booklet:{tutorName:'Tutor'}},attachments:[photo]});
  expect(state.birds[0].photoId).not.toBe(first);expect(state.attachments).toHaveLength(2);
  expect(state.birds[0].booklet).toMatchObject({currentDiet:'Alimentação revisada',tutorName:'Tutor'});
  expect(validateState(state).birds[0].photoId).toBe(state.birds[0].photoId);
 });
});
describe('migração dos registros existentes',()=>{
 it('reads schema 1 without altering its records and upgrades the schema to prevent old clients stripping new data',()=>{
  const state=emptyState();applyCommand(state,'real','saveBird',bird);
  const old={...structuredClone(state),schemaVersion:1};const upgraded=validateState(old);
  expect(old.schemaVersion).toBe(1);expect(upgraded.schemaVersion).toBe(2);expect(upgraded.birds).toEqual(old.birds);
 });
 it('keeps all new optional fields through validation used by backup and synchronization',()=>{
  const state=emptyState();const birdId=applyCommand(state,'real','saveBird',bird)!;
  state.birds[0].booklet={individualCode:'C-001',fieldOverrides:{medical_observations:'Observação revisada'},rearingType:'pais'};
  applyCommand(state,'real','saveTask',{birdId,title:'Consulta',dueDate:'2026-12-01',done:false,notes:'',reminderTime:'09:30',reminderMinutes:15});
  const restored=validateState(JSON.parse(JSON.stringify(state)));
  expect(restored.birds[0].booklet).toEqual(state.birds[0].booklet);expect(restored.tasks[0].reminderTime).toBe('09:30');
 });
});
