import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/domain/engine';
import { emptyState, type State } from '../src/domain/types';
import { validateState } from '../src/lib/validation';
import { bytesToBase64,sha256 } from '../src/domain/documents';
import { derivedTaskId } from '../src/domain/derived-tasks';

function run(state:State,action:string,data:unknown,scope:'real'|'demo'='real') {
 const draft=structuredClone(state);const result=applyCommand(draft,scope,action,data);validateState(draft);Object.assign(state,draft);return result!;
}
function fixture(scope:'real'|'demo'='real') {
 const state=emptyState(), species='Calopsita';
 const add=(sex:string,identification:string)=>run(state,'saveBird',{species,identification,sex,mutation:'Não informada',certainty:'informada',origin:'Origem informada',status:'reprodutor',statusDate:'2024-01-01',sexDate:'2024-01-01',mutationDate:'2024-01-01'},scope);
 const maleId=add('macho','M-1'),femaleId=add('fêmea','F-1');
 const pairId=run(state,'createPair',{name:'Casal QA',maleId,femaleId,startDate:'2024-01-01'},scope);
 const clutchId=run(state,'createClutch',{pairId,startDate:'2024-01-10'},scope);
 const speciesId=state.birds[0].speciesId!;
 const parameter=(overrides:Record<string,unknown>={})=>run(state,'species.save',{id:speciesId,name:species,incubationDays:22,eggCheckDays:7,chickFollowupDays:10,parameterSource:'Fonte fictícia isolada usada neste teste',active:true,...overrides},scope);
 const enable=(overrides:Record<string,unknown>={})=>run(state,'settings.save',{...state.settings,derivedTaskRules:{hatch:true,eggCheck:true,chickFollowup:true,...overrides}},scope);
 const egg=(overrides:Record<string,unknown>={})=>run(state,'createEgg',{clutchId,laidDate:'2024-01-11',incubationDate:'2024-01-12',...overrides},scope);
 return {state,speciesId,maleId,femaleId,pairId,clutchId,parameter,enable,egg,scope};
}

describe('agenda derivada vinculada a registros',()=>{
 it('starts with rules disabled and absent biological parameters rather than invented defaults',()=>{
  const f=fixture();f.egg();expect(f.state.tasks).toEqual([]);expect(f.state.settings.speciesCatalog.find(entry=>entry.id===f.speciesId)!.incubationDays).toBeNull();
  f.enable();expect(f.state.tasks).toEqual([]);expect(f.state.eggs[0].expectedHatchDate).toBe('');
 });
 it('creates one permanent task per configured work and preserves manual tasks',()=>{
  const f=fixture();f.parameter();f.enable();const eggId=f.egg();
  const manual=run(f.state,'saveTask',{birdId:f.femaleId,title:'Manutenção manual',dueDate:'2024-01-19'});
  expect(f.state.tasks.filter(t=>t.origin==='derived')).toHaveLength(2);
  expect(f.state.tasks.find(t=>t.derivationKey===`egg:${eggId}:hatch`)).toMatchObject({sourceType:'egg',sourceId:eggId,birdId:f.femaleId,dueDate:'2024-02-03',done:false});
  expect(f.state.tasks.find(t=>t.derivationKey===`egg:${eggId}:check`)?.dueDate).toBe('2024-01-19');
  const before=structuredClone(f.state.tasks);for(let n=0;n<3;n++)run(f.state,'task.recalculate',{});
  expect(f.state.tasks).toEqual(before);expect(f.state.tasks.find(t=>t.id===manual)?.origin).toBe('manual');
 });
 it('reprograms the existing task after incubation correction without changing its identity or completion',()=>{
  const f=fixture();f.parameter();f.enable();const eggId=f.egg();const task=f.state.tasks.find(t=>t.derivationKey===`egg:${eggId}:hatch`)!;
  run(f.state,'toggleTask',{id:task.id,done:true});
  run(f.state,'saveEgg',{id:eggId,incubationDate:'2024-01-15',eventDate:'2024-01-15'});
  const updated=f.state.tasks.find(t=>t.id===task.id)!;
  expect(updated).toMatchObject({id:task.id,dueDate:'2024-02-06',done:true});expect(updated.history?.map(h=>h.action)).toContain('concluída');expect(updated.history?.at(-1)?.action).toBe('reprogramada');
  expect(f.state.eggs[0].expectedHatchDate).toBe(updated.dueDate);expect(f.state.tasks).toHaveLength(2);
 });
 it('does not overwrite an explicit hatch forecast when species parameters change',()=>{
  const f=fixture();f.parameter();f.enable();const eggId=f.egg({expectedHatchDate:'2024-02-10'});f.parameter({incubationDays:30});
  expect(f.state.eggs[0]).toMatchObject({expectedHatchDate:'2024-02-10',expectedHatchSource:'manual'});
  expect(f.state.tasks.find(t=>t.derivationKey===`egg:${eggId}:hatch`)?.dueDate).toBe('2024-02-10');
 });
 it('derives an explicit forecast without inventing a missing incubation duration',()=>{
  const f=fixture();f.enable();f.egg({expectedHatchDate:'2024-02-10'});expect(f.state.tasks).toHaveLength(1);expect(f.state.settings.speciesCatalog.find(entry=>entry.id===f.speciesId)!.incubationDays).toBeNull();
 });
 it('updates configured forecasts once and does not append history repeatedly after a recalculation',()=>{
  const f=fixture();f.parameter();f.enable();f.egg();f.parameter({incubationDays:25});
  expect(f.state.eggs[0].expectedHatchDate).toBe('2024-02-06');const events=structuredClone(f.state.eggs[0].events),tasks=structuredClone(f.state.tasks);
  run(f.state,'task.recalculate',{});expect(f.state.eggs[0].events).toEqual(events);expect(f.state.tasks).toEqual(tasks);
 });
 it('resolves incompatible pending work on result, reopens the same identities, and retains the history',()=>{
  const f=fixture();f.parameter();f.enable();const eggId=f.egg(), ids=f.state.tasks.map(t=>t.id);
  run(f.state,'eggOutcome',{id:eggId,status:'perdido',eventDate:'2024-01-20',notes:'Registro fictício'});
  expect(f.state.tasks.every(t=>t.done&&t.resolvedAt&&t.resolutionReason)).toBe(true);
  expect(()=>run(f.state,'toggleTask',{id:ids[0],done:false})).toThrow(/Reabra o acompanhamento/);
  run(f.state,'saveEgg',{id:eggId,status:'incubando',eventDate:'2024-01-21',notes:'Correção fictícia do resultado'});
  expect(f.state.tasks.map(t=>t.id)).toEqual(ids);expect(f.state.tasks.every(t=>!t.done&&!t.resolvedAt)).toBe(true);expect(f.state.tasks[0].history?.map(h=>h.action)).toEqual(['gerada','resolvida','reativada']);
 });
 it('resolves removed rules and reactivates their tasks without duplication while preserving completed ones',()=>{
  const f=fixture();f.parameter();f.enable();const eggId=f.egg();const hatch=f.state.tasks.find(t=>t.derivationKey===`egg:${eggId}:hatch`)!;
  run(f.state,'toggleTask',{id:hatch.id,done:true});f.enable({hatch:false,eggCheck:false});expect(f.state.tasks).toHaveLength(2);
  f.enable();expect(f.state.tasks.find(t=>t.id===hatch.id)?.done).toBe(true);expect(f.state.tasks.find(t=>t.id!==hatch.id)?.done).toBe(false);
 });
 it('creates one chick and its follow-up without duplicating hatch work after rereading the state',()=>{
  const f=fixture();f.parameter();f.enable();const eggId=f.egg();const chickId=run(f.state,'hatchEgg',{eggId,hatchDate:'2024-02-03',identification:'FILHOTE-QA',mutation:'Não informada'});
  expect(f.state.birds).toHaveLength(3);expect(f.state.eggs[0]).toMatchObject({chickId,hatchDate:'2024-02-03'});expect(f.state.birds.find(b=>b.id===chickId)).toMatchObject({fatherId:f.maleId,motherId:f.femaleId});
  const followup=f.state.tasks.find(t=>t.derivationKey===`bird:${chickId}:followup`)!;expect(followup).toMatchObject({sourceType:'bird',sourceId:chickId,birdId:chickId,dueDate:'2024-02-13'});
  expect(f.state.tasks.filter(t=>t.sourceId===eggId).every(t=>t.done)).toBe(true);
  const restored=validateState(JSON.parse(JSON.stringify(f.state)));run(restored,'task.recalculate',{});expect(restored.tasks).toEqual(f.state.tasks);
  expect(()=>run(restored,'hatchEgg',{eggId,hatchDate:'2024-02-03',identification:'DUP',mutation:'Não informada'})).toThrow(/uma vez|já tem resultado/);expect(restored.birds).toHaveLength(3);
 });
 it('resolves chick monitoring when development ends and allows historical reproduction to close',()=>{
  const f=fixture();f.parameter();f.enable();const eggId=f.egg(),chickId=run(f.state,'hatchEgg',{eggId,hatchDate:'2024-02-03',identification:'FILHOTE-QA',mutation:'Não informada'});
  run(f.state,'saveBird',{id:chickId,status:'manejo',statusDate:'2024-02-10',statusReason:'Etapa concluída'});
  expect(f.state.tasks.find(t=>t.sourceId===chickId)?.resolvedAt).toBeTruthy();
  run(f.state,'closeClutch',{id:f.clutchId,endDate:'2024-02-04'});run(f.state,'closePair',{id:f.pairId,endDate:'2024-02-05'});expect(f.state.eggs).toHaveLength(1);expect(f.state.tasks).toHaveLength(3);
 });
 it('allows a historical clutch closure after a parameter recalculation without inventing a current-day biological event',()=>{
  const f=fixture();f.parameter();f.enable();const eggId=f.egg();f.parameter({incubationDays:25});
  run(f.state,'eggOutcome',{id:eggId,status:'perdido',eventDate:'2024-01-20',notes:'Resultado realmente registrado no teste'});
  run(f.state,'closeClutch',{id:f.clutchId,endDate:'2024-01-21'});expect(f.state.clutches[0].endDate).toBe('2024-01-21');
 });
 it('prevents derived source/date reassignment while keeping reminders and notes editable',()=>{
  const f=fixture();f.parameter();f.enable();f.egg();const task=f.state.tasks[0];
  expect(()=>run(f.state,'saveTask',{...task,dueDate:'2024-03-01'})).toThrow(/derivada/);
  run(f.state,'saveTask',{...task,reminderTime:'09:30',reminderMinutes:15,notes:'Observação do criador'});
  expect(f.state.tasks[0]).toMatchObject({reminderTime:'09:30',reminderMinutes:15,notes:'Observação do criador'});f.parameter({eggCheckDays:8});expect(f.state.tasks[0].notes).toBe('Observação do criador');
 });
 it('keeps a stable UUID that permits direct attachments on a derived task through the existing link validator',()=>{
  const f=fixture();f.parameter();f.enable();f.egg();const task=f.state.tasks[0];
  expect(task.id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  expect(task.id).toBe(derivedTaskId('real',task.derivationKey!));expect(task.id).not.toBe(derivedTaskId('demo',task.derivationKey!));
  const bytes=new TextEncoder().encode('Registro sintético de acompanhamento');
  run(f.state,'save.withAttachments',{action:'saveTask',data:{...task,notes:'Observação preservada'},attachments:[{title:'Arquivo da tarefa',category:'Agenda',date:'2024-01-12',fileName:'acompanhamento.txt',mime:'text/plain',size:bytes.length,base64:bytesToBase64(bytes),sha256:sha256(bytes)}]});
  expect(f.state.attachments[0]).toMatchObject({sourceType:'task',sourceId:task.id,birdId:f.femaleId});expect(f.state.tasks[0].notes).toBe('Observação preservada');
 });
 it('keeps identical demonstration and real work separate and rejects duplicate or cross-scope derived references',()=>{
  const f=fixture('demo');f.parameter();f.enable();f.egg();expect(f.state.tasks.every(t=>t.scope==='demo')).toBe(true);
  const cross=structuredClone(f.state);cross.tasks[0].scope='real';expect(()=>validateState(cross)).toThrow(/vínculos/);
  const duplicate=structuredClone(f.state);duplicate.tasks.push({...duplicate.tasks[0],id:'OTHER'});expect(()=>validateState(duplicate)).toThrow(/derivada duplicada/);
 });
});
