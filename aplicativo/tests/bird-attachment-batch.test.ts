import {describe,expect,it} from 'vitest';
import {applyCommand} from '../src/domain/engine';
import {bytesToBase64,sha256} from '../src/domain/documents';
import {emptyState} from '../src/domain/types';
import {validateState} from '../src/lib/validation';

const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ9sAAAAASUVORK5CYII='),character=>character.charCodeAt(0));
function file(name='observacao.txt',photo=false){
 const bytes=photo?png:new TextEncoder().encode('Observação sintética isolada para o teste');
 return {title:photo?'Imagem QA':'Observação QA',category:photo?'Foto':'Cadastro',date:'2024-01-01',fileName:name,mime:photo?'image/png':'text/plain',base64:bytesToBase64(bytes),size:bytes.length,sha256:sha256(bytes),notes:'Arquivo de teste',shareWithCustomer:false};
}
function fixture(){
 const state=emptyState();
 const register=(identification:string,sex:string,birthDate:string,parents:Record<string,unknown>={})=>applyCommand(state,'real','saveBird',{identification,sex,birthDate,species:'Calopsita',mutation:'Não informada',certainty:'informada',origin:'Origem informada no teste',status:'manejo',...parents})!;
 const fatherId=register('PAI-QA','macho','2020-01-01'),motherId=register('MAE-QA','fêmea','2020-01-01');
 const birdId=register('AVE-QA','indeterminado','2021-01-01',{fatherId,motherId,name:'Ave QA',microchip:'CHIP-QA',enclosure:'Recinto QA',responsible:'Criador QA',notes:'Notas preexistentes preservadas'});
 applyCommand(state,'real','save.withAttachments',{action:'bird.booklet',data:{id:birdId,booklet:{currentDiet:'Dado informado para o teste'}},attachments:[{...file('foto-anterior.png',true),role:'photo'}]});
 applyCommand(state,'real','saveHealth',{birdId,date:'2024-01-01',kind:'pesagem',title:'Pesagem QA',weightGrams:90,author:'Criador QA'});
 applyCommand(state,'real','saveTask',{birdId,title:'Tarefa preexistente QA',dueDate:'2024-01-01',done:true});
 return {state,birdId,fatherId,motherId};
}
describe('anexo direto na ficha: lote atômico',()=>{
 it('adds documents and ordinary images without changing the principal photo, genealogical links or existing histories',()=>{
  const f=fixture(),birdBefore=structuredClone(f.state.birds.find(b=>b.id===f.birdId)!),prior=structuredClone(f.state);
  expect(applyCommand(f.state,'real','attachment.addBatch',{birdId:f.birdId,attachments:[file(),file('imagem-extra.png',true)]})).toBe(f.birdId);
  expect(f.state.birds.find(b=>b.id===f.birdId)).toEqual(birdBefore);expect(f.state.health).toEqual(prior.health);expect(f.state.tasks).toEqual(prior.tasks);expect(f.state.mutations).toEqual(prior.mutations);
  expect(f.state.attachments.slice(0,prior.attachments.length)).toEqual(prior.attachments);expect(f.state.audit.slice(0,prior.audit.length)).toEqual(prior.audit);
  const added=f.state.attachments.slice(prior.attachments.length);expect(added).toHaveLength(2);expect(added.every(a=>a.birdId===f.birdId&&a.sourceId===f.birdId&&a.sourceType==='bird'&&a.scope==='real')).toBe(true);
  const reopened=validateState(JSON.parse(JSON.stringify(f.state)));expect(reopened.birds.find(b=>b.id===f.birdId)).toEqual(birdBefore);expect(reopened.attachments).toEqual(f.state.attachments);
 });
 it('changes only the principal-photo link when the user explicitly marks a valid image',()=>{
  const f=fixture(),before=structuredClone(f.state),originalBird=before.birds.find(b=>b.id===f.birdId)!;
  applyCommand(f.state,'real','attachment.addBatch',{birdId:f.birdId,attachments:[file(),{...file('nova-foto.png',true),role:'photo'}]});
  const updated=f.state.birds.find(b=>b.id===f.birdId)!;expect(updated.photoId).toBe(f.state.attachments.at(-1)!.id);expect(updated.photoId).not.toBe(originalBird.photoId);
  expect(updated).toEqual({...originalBird,photoId:updated.photoId});expect(f.state.attachments.find(a=>a.id===originalBird.photoId)).toEqual(before.attachments[0]);
 });
 it('rolls back the first valid file and proposed photo when a second file fails integrity, leaving no orphan or audit entry',()=>{
  const f=fixture(),before=structuredClone(f.state);
  expect(()=>applyCommand(f.state,'real','attachment.addBatch',{birdId:f.birdId,attachments:[{...file('tentativa-foto.png',true),role:'photo'},{...file('segundo-invalido.txt'),sha256:'0'.repeat(64)}]})).toThrow(/integridade/);
  expect(f.state).toEqual(before);expect(validateState(f.state)).toEqual(validateState(before));
 });
 it('rejects a photo role on a document, multiple principal photos and empty batches without modifying state',()=>{
  const f=fixture(),before=structuredClone(f.state);
  expect(()=>applyCommand(f.state,'real','attachment.addBatch',{birdId:f.birdId,attachments:[{...file(),role:'photo'}]})).toThrow(/JPG ou PNG/);
  expect(()=>applyCommand(f.state,'real','attachment.addBatch',{birdId:f.birdId,attachments:[{...file('a.png',true),role:'photo'},{...file('b.png',true),role:'photo'}]})).toThrow(/somente uma foto/);
  expect(()=>applyCommand(f.state,'real','attachment.addBatch',{birdId:f.birdId,attachments:[]})).toThrow();expect(f.state).toEqual(before);
 });
 it('refuses missing or cross-scope birds and binds accepted files to the actual bird rather than caller-supplied links',()=>{
  const f=fixture(),before=structuredClone(f.state);
  expect(()=>applyCommand(f.state,'demo','attachment.addBatch',{birdId:f.birdId,attachments:[file()]})).toThrow(/Ave não encontrada/);
  expect(()=>applyCommand(f.state,'real','attachment.addBatch',{birdId:crypto.randomUUID(),attachments:[file()]})).toThrow(/Ave não encontrada/);expect(f.state).toEqual(before);
  applyCommand(f.state,'real','attachment.addBatch',{birdId:f.birdId,attachments:[{...file(),scope:'demo',birdId:f.fatherId,contactId:crypto.randomUUID(),saleId:crypto.randomUUID(),sourceType:'purchase',sourceId:crypto.randomUUID(),previousId:before.attachments[0].id}]});
  expect(f.state.attachments.at(-1)).toMatchObject({scope:'real',birdId:f.birdId,contactId:null,saleId:null,sourceType:'bird',sourceId:f.birdId,previousId:null,version:1});expect(validateState(f.state).birds.find(b=>b.id===f.birdId)).toEqual(before.birds.find(b=>b.id===f.birdId));
 });
});
