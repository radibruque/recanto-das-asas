import { z } from 'zod';
import { breedingHandler } from './breeding';
import { commercialHandler } from './commercial';
import { documentsHandler } from './documents';
import { id, required, text, today } from './shared';
import type { State, Scope } from './types';
import { previewImport } from '../lib/import';
export function applyCommand(state:State,scope:Scope,action:string,data:unknown):string|undefined {
 if(!['real','demo'].includes(scope))throw new Error('Espaço inválido.');
 let recordId:string|undefined;
 if(action==='initializeDemo'){
  if(scope!=='demo')throw new Error('Exemplos só podem ser criados na demonstração.');
  if(state.birds.some(b=>b.scope==='demo'))return undefined;
  const first=breedingHandler(state,scope,'saveBird',{identification:'EX-001',name:'Azul',species:'Periquito-australiano (Melopsittacus undulatus)',sex:'macho',mutation:'Azul',certainty:'observada',origin:'Exemplo fictício',birthDate:'2025-04-12',status:'reprodutor'});
  const second=breedingHandler(state,scope,'saveBird',{identification:'EX-002',name:'Lua',species:'Periquito-australiano (Melopsittacus undulatus)',sex:'fêmea',mutation:'Verde',certainty:'observada',origin:'Exemplo fictício',birthDate:'2025-06-08',status:'reprodutor'});
  const pair=breedingHandler(state,scope,'createPair',{name:'Casal de exemplo',maleId:first?.id,femaleId:second?.id,startDate:'2026-09-01'});
  const clutch=breedingHandler(state,scope,'createClutch',{pairId:pair?.id,startDate:'2026-09-10'});
  breedingHandler(state,scope,'createEgg',{clutchId:clutch?.id,laidDate:'2026-09-11'});
  breedingHandler(state,scope,'saveBird',{identification:'EX-003',name:'Pingo',species:'Calopsita (Nymphicus hollandicus)',sex:'macho',mutation:'Cinza',certainty:'observada',origin:'Exemplo fictício',birthDate:'2025-01-20',status:'disponível'});
  commercialHandler(state,scope,'contact.save',{kind:'cliente',name:'Cliente fictício',phone:'',email:'',notes:'Somente demonstração'});
  commercialHandler(state,scope,'account.save',{name:'Caixa fictício',openingCents:0});
  recordId=first?.id;
 }else if(action==='birds.import'){
  const d=z.object({csv:z.string().max(5*1024*1024)}).parse(data);const rows=previewImport(d.csv,state,scope);if(!rows.length||rows.some(r=>r.errors.length))throw new Error('Corrija todas as linhas da prévia antes de importar.');
  const mappings=new Map(state.birds.filter(b=>b.scope===scope).map(b=>[b.identification,b.id]));
  for(const row of rows){const v=row.values;const result=breedingHandler(state,scope,'saveBird',{identification:v.identificacao,name:v.nome,species:v.especie,sex:v.sexo,mutation:v.mutacao,certainty:'informada',mutationSource:'Planilha importada pelo proprietário',origin:v.origem,birthDate:v.nascimento,status:'manejo'});if(result?.id)mappings.set(v.identificacao,result.id);}
  for(const row of rows){const v=row.values;if(!v.pai&&!v.mae)continue;const bird=state.birds.find(b=>b.id===mappings.get(v.identificacao))!;breedingHandler(state,scope,'saveBird',{...bird,fatherId:v.pai?mappings.get(v.pai):null,motherId:v.mae?mappings.get(v.mae):null,mutationSource:'Planilha importada pelo proprietário'});}
  recordId='importacao-'+rows.length;
 }else if(action==='settings.save'){
  const values=z.object({name:required,phone:text,email:text,address:text,backupDays:z.number().int().min(1).max(365),categories:z.array(required).min(1).max(100),speciesEstimates:z.record(z.number().int().min(1).max(120))}).parse(data);Object.assign(state.settings,values);recordId='settings';
 }else if(action==='backup.record'){
  const d=z.object({at:required,sha256:z.string().regex(/^[a-f0-9]{64}$/),size:z.number().int().positive()}).parse(data);state.settings.lastBackupAt=d.at;state.settings.backupHistory.push({...d,verified:true});state.settings.backupHistory=state.settings.backupHistory.slice(-100);recordId=d.sha256;
 }else if(action==='support.save'){
  const d=z.object({id:z.string().optional(),description:required,steps:text,expected:text,actual:text,errorCode:text,priority:z.enum(['baixa','normal','alta']),status:z.enum(['aberto','em análise','corrigido']).default('aberto'),fixedVersion:text}).parse(data);
  const old=d.id?state.support.find(s=>s.id===d.id):undefined;if(d.id&&!old)throw new Error('Relato não encontrado.');
  const record={...d,id:old?.id??id(),number:old?.number??'RA-'+(state.support.length+1).toString().padStart(5,'0'),createdAt:old?.createdAt??new Date().toISOString(),version:state.settings.version,platform:typeof navigator==='undefined'?'Teste Node.js':navigator.userAgent};
  if(old)state.support[state.support.indexOf(old)]=record;else state.support.push(record);recordId=record.id;
 }else{
  const result=breedingHandler(state,scope,action,data)??commercialHandler(state,scope,action,data)??documentsHandler(state,scope,action,data);
  if(!result)throw new Error('Operação não reconhecida.');recordId=result.id;
 }
 const reason=data&&typeof data==='object'&&'reason' in data&&typeof data.reason==='string'?data.reason:'';
 state.audit.push({id:id(),scope,at:new Date().toISOString(),author:'Proprietário',action,recordId:recordId??'',reason});
 return recordId;
}
