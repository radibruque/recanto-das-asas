import type { Scope, State, Task, TaskHistory } from './types';
import { incubationDaysForBird, speciesForBird } from './species';
import { sha256 } from './documents';

/** Application-specific UUIDv8: stable across devices and accepted by existing attachment links. */
export function derivedTaskId(scope:Scope,key:string):string {
 const hash=sha256(new TextEncoder().encode(`recanto-derived-task:${scope}:${key}`)).slice(0,32);
 const bits=hash.slice(0,12)+'8'+hash.slice(13,16)+(8|(parseInt(hash[16],16)&3)).toString(16)+hash.slice(17);
 return `${bits.slice(0,8)}-${bits.slice(8,12)}-${bits.slice(12,16)}-${bits.slice(16,20)}-${bits.slice(20)}`;
}

export function addDays(value:string,days:number):string {
 const date=new Date(value+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);
}
const history=(task:Task,action:TaskHistory['action'],reason:string)=>{
 task.history??=[];task.history.push({at:new Date().toISOString(),action,dueDate:task.dueDate,reason});
};
export function recordTaskHistory(task:Task,action:TaskHistory['action'],reason=''):void {history(task,action,reason);}

/** Reconcile by a permanent source key: never append a second task for the same work. */
export function reconcileDerivedTasks(state:State,scope:Scope):void {
 const rules=state.settings.derivedTaskRules;
 const desired=new Map<string,Pick<Task,'birdId'|'title'|'dueDate'|'notes'|'sourceType'|'sourceId'>>();
 const pairs=new Map(state.pairs.filter(p=>p.scope===scope).map(p=>[p.id,p]));
 const clutches=new Map(state.clutches.filter(c=>c.scope===scope).map(c=>[c.id,c]));
 const birds=new Map(state.birds.filter(b=>b.scope===scope).map(b=>[b.id,b]));
 for(const egg of state.eggs.filter(e=>e.scope===scope)){
  const clutch=clutches.get(egg.clutchId),pair=clutch&&pairs.get(clutch.pairId);
  const mother=pair&&birds.get(pair.femaleId),father=pair&&birds.get(pair.maleId);
  if(!clutch||!pair||!mother||!father)continue;
  const species=speciesForBird(state,father);
  const active=egg.status==='incubando'&&!clutch.endDate&&!pair.endDate;
  if(active&&egg.expectedHatchSource==='species'){
   const configured=incubationDaysForBird(state,father);
   const forecast=configured!==null?addDays(egg.incubationDate||egg.laidDate,configured):'';
   // A parameter recalculation is not a biological event dated today. Its
   // trace remains in task history and the command audit, so a real historical
   // clutch closure is not forced to occur after this configuration change.
   if(forecast!==egg.expectedHatchDate)egg.expectedHatchDate=forecast;
  }
  const name=`Ovo ${egg.number} · ${pair.name}`;
  const note='Tarefa derivada do registro reprodutivo; a data é uma estimativa de acompanhamento, sem diagnóstico.';
  if(active&&rules.hatch&&egg.expectedHatchDate){
   desired.set(`egg:${egg.id}:hatch`,{birdId:mother.id,title:`Conferir previsão de eclosão · ${name}`,dueDate:egg.expectedHatchDate,notes:note,sourceType:'egg',sourceId:egg.id});
  }
  if(active&&rules.eggCheck&&species?.active&&species.eggCheckDays!==null){
   desired.set(`egg:${egg.id}:check`,{birdId:mother.id,title:`Acompanhamento do ovo · ${name}`,dueDate:addDays(egg.incubationDate||egg.laidDate,species.eggCheckDays),notes:`${note} Parâmetro: ${species.eggCheckDays} dias. Fonte: ${species.parameterSource||'não informada no cadastro anterior'}.`,sourceType:'egg',sourceId:egg.id});
  }
  const chick=egg.chickId?birds.get(egg.chickId):undefined;
  if(egg.status==='eclodido'&&chick?.status==='filhote'&&chick.birthDate&&rules.chickFollowup&&species?.active&&species.chickFollowupDays!==null){
   desired.set(`bird:${chick.id}:followup`,{birdId:chick.id,title:`Acompanhar filhote · ${chick.name||chick.identification}`,dueDate:addDays(chick.birthDate,species.chickFollowupDays),notes:`Parâmetro cadastrado: ${species.chickFollowupDays} dias. Fonte: ${species.parameterSource||'não informada no cadastro anterior'}. Registre somente observações reais.`,sourceType:'bird',sourceId:chick.id});
  }
 }
 const existing=new Map(state.tasks.filter(t=>t.scope===scope&&t.origin==='derived'&&t.derivationKey).map(t=>[t.derivationKey!,t]));
 for(const [key,record] of desired){
  const task=existing.get(key);
  if(task){
   const changed=task.dueDate!==record.dueDate||task.birdId!==record.birdId||task.derivationNotes!==record.notes;
   if(changed){const {notes,title:_,...fields}=record;Object.assign(task,fields,{derivationNotes:notes});history(task,'reprogramada','Datas ou parâmetros do registro relacionado foram atualizados.');}
   if(task.resolvedAt){delete task.resolvedAt;delete task.resolutionReason;task.done=false;history(task,'reativada','O acompanhamento voltou a estar ativo.');}
  }else{
   const created:Task={id:derivedTaskId(scope,key),scope,...record,notes:'',derivationNotes:record.notes,done:false,origin:'derived',derivationKey:key,history:[]};
   history(created,'gerada','Gerada a partir de datas e parâmetros configurados.');state.tasks.push(created);
  }
 }
 for(const [key,task] of existing)if(!desired.has(key)&&!task.done){
  task.done=true;task.resolvedAt=new Date().toISOString();task.resolutionReason='O acompanhamento foi encerrado, os parâmetros foram removidos ou esta regra foi desativada.';
  history(task,'resolvida',task.resolutionReason);
 }
}
