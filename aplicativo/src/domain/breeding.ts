import { z } from 'zod';
import type { Bird, BirdStatus, Handler, State, Scope } from './types';
import { cents, date, ensure, id, related, required, text, today } from './shared';
import { bookletDataSchema } from './booklet-data';

const actualDate = date.refine(v => v <= today(), 'A data não pode estar no futuro.');
const optionalDate = z.union([actualDate, z.literal('')]).default('');
const optionalId = z.string().trim().min(1).nullable().default(null);
const statuses = ['filhote','manejo','reprodutor','disponível','reservado','vendido','doado','transferido','falecido'] as const;
const sex = z.enum(['macho','fêmea','indeterminado']);
const certainty = z.enum(['observada','informada','confirmada']);
const birdSchema = z.object({
  id: required.optional(), identification: required, name: text, species: required,
  sex, mutation: required, certainty, carriers: text, origin: required, notes: text,
  birthDate: optionalDate, fatherId: optionalId, motherId: optionalId,
  status: z.enum(statuses).default('manejo'), scientificName: text, microchip: text,
  sexMethod: text, sexSource: text, visualDescription: text, birthEstimated: z.boolean().default(false),
  breeder: text, supplierId: optionalId, acquiredDate: optionalDate,
  acquisitionCents: cents.default(0), acquisitionMethod: text,
  enclosure: text, responsible: text, photoId: optionalId, custodyDate:actualDate.optional(),custodyReason:text,
  statusDate: actualDate.optional(), statusReason: text,
  sexDate: actualDate.optional(), sexNotes: text, sexAttachmentId: optionalId,
  mutationDate: actualDate.optional(), mutationSource: text, mutationNotes: text, mutationAttachmentId: optionalId,
  booklet: bookletDataSchema.optional(),
});

function findBird(state:State, scope:Scope, recordId:string):Bird {
  const record = state.birds.find(v => v.id === recordId && v.scope === scope);
  ensure(record, 'Ave não encontrada neste espaço.'); return record;
}
function sameIdentification(a:string,b:string) { return a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR'); }
function attachment(state:State,scope:Scope,attachmentId:string|null,birdId:string) {
  if (!attachmentId) return;
  const a = state.attachments.find(v => v.id === attachmentId && v.scope === scope);
  ensure(a && a.birdId === birdId, 'O documento precisa pertencer à ave neste espaço.');
}
function validateBird(state:State,scope:Scope,d:z.infer<typeof birdSchema>,recordId:string,existing?:Bird) {
  const birds = state.birds.filter(v=>v.scope===scope);
  ensure(!birds.some(b=>b.id!==recordId&&sameIdentification(b.identification,d.identification)), 'Esta identificação já está cadastrada.');
  ensure(!d.microchip || !birds.some(b=>b.id!==recordId&&b.microchip&&sameIdentification(b.microchip,d.microchip)), 'Este microchip já está cadastrado.');
  if (d.supplierId) ensure(state.contacts.some(c=>c.id===d.supplierId&&c.scope===scope&&c.kind==='fornecedor'), 'Fornecedor não encontrado neste espaço.');
  if (d.acquiredDate && d.birthDate) ensure(d.acquiredDate>=d.birthDate,'A aquisição não pode anteceder o nascimento.');
  if(d.birthDate) {
    ensure((d.statusDate??today())>=d.birthDate,'A situação não pode anteceder o nascimento.');
    ensure((d.sexDate??today())>=d.birthDate,'O registro de sexagem não pode anteceder o nascimento.');
    ensure((d.mutationDate??today())>=d.birthDate,'O registro de mutação não pode anteceder o nascimento.');
    ensure((d.custodyDate??today())>=d.birthDate,'A movimentação de recinto ou responsável não pode anteceder o nascimento.');
  }
  for (const parentId of [d.fatherId,d.motherId]) {
    if (!parentId) continue;
    ensure(parentId!==recordId,'Uma ave não pode ser seu próprio ancestral.');
    const p = findBird(state,scope,parentId);
    ensure(p.species===d.species,'Os pais devem ser da mesma espécie.');
    ensure(!d.birthDate||!p.birthDate||p.birthDate<d.birthDate,'O nascimento do filhote deve ser posterior ao dos pais.');
    const ancestors = (currentId:string,seen=new Set<string>()):boolean => {
      if(currentId===recordId) return true;
      if(seen.has(currentId)) return false;
      seen.add(currentId);
      const current=birds.find(b=>b.id===currentId);
      return !!current && [current.fatherId,current.motherId].some(pId=>pId?ancestors(pId,seen):false);
    };
    ensure(!ancestors(parentId),'Este vínculo criaria um ciclo de parentesco.');
  }
  if(d.fatherId) ensure(findBird(state,scope,d.fatherId).sex==='macho','O pai precisa ter sexo registrado como macho.');
  if(d.motherId) ensure(findBird(state,scope,d.motherId).sex==='fêmea','A mãe precisa ter sexo registrado como fêmea.');
  for (const child of birds.filter(b=>b.fatherId===recordId||b.motherId===recordId)) {
    ensure(child.species===d.species,'A espécie precisa ser compatível com os descendentes vinculados.');
    ensure(d.sex===(child.fatherId===recordId?'macho':'fêmea'),'A correção de sexo conflita com o papel parental registrado. Corrija os vínculos primeiro.');
    ensure(!d.birthDate||!child.birthDate||d.birthDate<child.birthDate,'O nascimento deve anteceder o dos descendentes.');
  }
  const linkedPairs=state.pairs.filter(p=>p.scope===scope&&(p.maleId===recordId||p.femaleId===recordId));
  for(const p of linkedPairs) {
    const counterpart=findBird(state,scope,p.maleId===recordId?p.femaleId:p.maleId);
    ensure(d.species===counterpart.species,'A espécie conflita com um casal registrado.');
    ensure(d.sex===(p.maleId===recordId?'macho':'fêmea'),'A correção de sexo conflita com o papel registrado no casal.');
    ensure(!d.birthDate||d.birthDate<=p.startDate,'O nascimento não pode ser posterior à formação do casal.');
    if(!p.endDate) ensure(!['reservado','vendido','doado','transferido','falecido'].includes(d.status),'Encerre o casal ativo antes de alterar a disponibilidade da ave.');
  }
  if(existing) {
    if(state.eggs.some(e=>e.scope===scope&&e.chickId===recordId)) ensure(d.fatherId===existing.fatherId&&d.motherId===existing.motherId&&d.birthDate===existing.birthDate&&d.species===existing.species,'Os pais, a espécie e o nascimento do filhote estão vinculados à eclosão.');
    if(state.sales.some(s=>s.scope===scope&&!['cancelada','devolvida','orçamento'].includes(s.status)&&s.items.some(i=>i.kind==='ave'&&i.refId===recordId))) ensure(d.status===existing.status,'Altere a situação pela venda vinculada para preservar o histórico comercial.');
    if(d.birthDate) {
      ensure(existing.statusHistory.every(h=>h.date>=d.birthDate)&&(existing.sexHistory??[]).every(h=>h.date>=d.birthDate)&&(existing.custodyHistory??[]).every(h=>h.date>=d.birthDate)&&state.mutations.filter(m=>m.scope===scope&&m.birdId===recordId).every(m=>(m.date||m.recordedAt.slice(0,10))>=d.birthDate)&&state.health.filter(h=>h.scope===scope&&h.birdId===recordId).every(h=>h.date>=d.birthDate),'O nascimento conflita com registros históricos anteriores da ave.');
    }
    if(d.status!==existing.status) {
      ensure(d.statusReason.length>0,'Informe o motivo da mudança de situação.');
      ensure((d.statusDate??today())>=(existing.statusHistory.at(-1)?.date??''),'A mudança não pode anteceder o último evento de situação.');
      ensure(!d.birthDate||(d.statusDate??today())>=d.birthDate,'A situação não pode anteceder o nascimento.');
    }
    if(d.sex!==existing.sex||d.sexMethod!==existing.sexMethod||d.sexSource!==existing.sexSource) {
      ensure(d.sex==='indeterminado'||d.sexSource.length>0,'Informe a fonte da correção de sexagem.');
      ensure((d.sexDate??today())>=(existing.sexHistory?.at(-1)?.date??''),'A correção não pode anteceder o último registro de sexagem.');
    }
    if(existing.mutation!==d.mutation||existing.certainty!==d.certainty||existing.carriers!==d.carriers||d.mutationSource||d.mutationNotes||d.mutationAttachmentId) {
      ensure(d.mutationSource.length>0,'Informe a fonte da correção de mutação ou portadores.');
      const previous=state.mutations.filter(m=>m.scope===scope&&m.birdId===recordId).at(-1);
      ensure((d.mutationDate??today())>=(previous?.date??previous?.recordedAt.slice(0,10)??''),'A correção não pode anteceder o último registro de mutação.');
    }
  }
  attachment(state,scope,d.photoId,recordId);
  if(d.photoId) ensure(state.attachments.find(a=>a.id===d.photoId)?.mime.startsWith('image/'),'A foto deve ser um arquivo de imagem.');
  attachment(state,scope,d.sexAttachmentId,recordId); attachment(state,scope,d.mutationAttachmentId,recordId);
}

export const breedingHandler:Handler = (state,scope,action,data) => {
  const now=new Date().toISOString();
  const bird=(recordId:string)=>findBird(state,scope,recordId);
  const pair=(recordId:string)=> {const p=state.pairs.find(p=>p.id===recordId&&p.scope===scope);ensure(p,'Casal não encontrado neste espaço.');return p;};
  const clutch=(recordId:string)=> {const c=state.clutches.find(c=>c.id===recordId&&c.scope===scope);ensure(c,'Postura não encontrada neste espaço.');return c;};
  const egg=(recordId:string)=> {const e=state.eggs.find(e=>e.id===recordId&&e.scope===scope);ensure(e,'Ovo não encontrado neste espaço.');return e;};
  if(action==='saveBird') {
    const raw=z.object({id:required.optional()}).passthrough().parse(data);
    const existing=raw.id?bird(raw.id):undefined;
    const d=birdSchema.parse({...existing,...raw,booklet:raw.booklet===undefined?existing?.booklet:{...existing?.booklet,...bookletDataSchema.parse(raw.booklet)}}); const recordId=existing?.id??id();
    validateBird(state,scope,d,recordId,existing);
    const {statusDate,statusReason,sexDate,sexNotes,sexAttachmentId,mutationDate,mutationSource,mutationNotes,mutationAttachmentId,custodyDate,custodyReason,...fields}=d;
    const statusHistory=existing?[...existing.statusHistory]:[];
    if(!existing||existing.status!==d.status) statusHistory.push({date:statusDate??today(),status:d.status,reason:statusReason||'Cadastro inicial'});
    const sexHistory=existing?.sexHistory?[...existing.sexHistory]:[];
    if(!existing||existing.sex!==d.sex||existing.sexMethod!==d.sexMethod||existing.sexSource!==d.sexSource) sexHistory.push({date:sexDate??today(),sex:d.sex,method:d.sexMethod,source:d.sexSource,notes:sexNotes,attachmentId:sexAttachmentId});
    const custodyHistory=[...(existing?.custodyHistory??[])];if(!existing||existing.responsible!==d.responsible||existing.enclosure!==d.enclosure){if(existing){ensure(custodyReason.length>0,'Informe o motivo da mudança de recinto ou responsável.');ensure((custodyDate??today())>=(custodyHistory.at(-1)?.date??''),'A movimentação não pode anteceder o último registro de responsabilidade.');}custodyHistory.push({date:custodyDate??today(),responsible:d.responsible,enclosure:d.enclosure,reason:custodyReason||'Cadastro inicial'});}const record:Bird={...fields,id:recordId,scope,createdAt:existing?.createdAt??now,statusHistory,sexHistory,custodyHistory};
    if(existing) state.birds[state.birds.indexOf(existing)]=record; else state.birds.push(record);
    if(!existing||existing.mutation!==d.mutation||existing.certainty!==d.certainty||existing.carriers!==d.carriers||mutationSource||mutationNotes||mutationAttachmentId) state.mutations.push({id:id(),scope,birdId:recordId,mutation:d.mutation,certainty:d.certainty,carriers:d.carriers,recordedAt:now,date:mutationDate??today(),source:mutationSource,notes:mutationNotes,attachmentId:mutationAttachmentId});
    return {id:recordId};
  }
  if(action==='bird.booklet') {
    const d=z.object({id:required,booklet:bookletDataSchema,photoId:optionalId.optional()}).parse(data),b=bird(d.id);
    if(d.photoId!==undefined) {
      attachment(state,scope,d.photoId,b.id);
      if(d.photoId)ensure(state.attachments.find(a=>a.id===d.photoId)?.mime.startsWith('image/'),'A foto deve ser um arquivo de imagem.');
    }
    b.booklet={...b.booklet,...d.booklet};
    if(d.photoId!==undefined)b.photoId=d.photoId;
    return {id:b.id};
  }
  if(action==='deleteBird') {
    const d=z.object({id:required}).parse(data), b=bird(d.id);
    const linked=state.birds.some(v=>v.scope===scope&&(v.fatherId===b.id||v.motherId===b.id))||state.pairs.some(p=>p.scope===scope&&(p.maleId===b.id||p.femaleId===b.id))||state.eggs.some(e=>e.scope===scope&&e.chickId===b.id)||state.sales.some(s=>s.scope===scope&&s.items.some(i=>i.refId===b.id&&i.kind==='ave'))||state.attachments.some(a=>a.scope===scope&&a.birdId===b.id)||state.documents.some(a=>a.scope===scope&&a.birdId===b.id)||state.health.some(h=>h.scope===scope&&h.birdId===b.id)||state.tasks.some(t=>t.scope===scope&&t.birdId===b.id);
    ensure(!linked,'A ave possui vínculos. Preserve o cadastro e altere sua situação.');
    ensure(b.statusHistory.length<=1&&state.mutations.filter(m=>m.scope===scope&&m.birdId===b.id).length<=1&&(b.sexHistory?.length??0)<=1&&(b.custodyHistory?.length??0)<=1,'A ave possui histórico. Preserve o cadastro e altere sua situação.');
    state.birds=state.birds.filter(v=>v!==b); state.mutations=state.mutations.filter(v=>v.scope!==scope||v.birdId!==b.id); return {id:b.id};
  }
  if(action==='createPair') {
    const d=z.object({name:required,maleId:required,femaleId:required,startDate:actualDate,notes:text,enclosure:text,acknowledgeRelated:z.boolean().default(false)}).parse(data),m=bird(d.maleId),f=bird(d.femaleId);
    ensure(m.id!==f.id&&m.sex==='macho'&&f.sex==='fêmea','Selecione um macho e uma fêmea distintos.');
    ensure(m.species===f.species,'As aves precisam ser da mesma espécie.');
    ensure(![m,f].some(b=>['reservado','vendido','doado','transferido','falecido'].includes(b.status)),'Uma das aves não está disponível para reprodução.');
    ensure(!state.pairs.some(p=>p.scope===scope&&!p.endDate&&[p.maleId,p.femaleId].some(i=>i===m.id||i===f.id)),'Uma das aves já pertence a um casal ativo.');
    ensure([m,f].every(b=>!b.birthDate||b.birthDate<=d.startDate),'A formação do casal não pode anteceder o nascimento das aves.');
    if(related(m,f,state.birds.filter(b=>b.scope===scope))) ensure(d.acknowledgeRelated,'Há parentesco conhecido. Confirme a decisão antes de registrar.');
    const record={id:id(),scope,name:d.name,maleId:m.id,femaleId:f.id,startDate:d.startDate,endDate:null,notes:d.notes,enclosure:d.enclosure,relatedAcknowledged:d.acknowledgeRelated};state.pairs.push(record);return {id:record.id};
  }
  if(action==='closePair') {
    const d=z.object({id:required,endDate:actualDate}).parse(data),p=pair(d.id);
    ensure(!p.endDate,'Este casal já foi encerrado.');ensure(d.endDate>=p.startDate,'Data anterior à formação do casal.');
    const cs=state.clutches.filter(c=>c.scope===scope&&c.pairId===p.id);ensure(cs.every(c=>c.endDate),'Encerre as posturas abertas antes de encerrar o casal.');ensure(cs.every(c=>(c.endDate??'')<=d.endDate),'A data deve ser posterior ao encerramento das posturas.');p.endDate=d.endDate;return {id:p.id};
  }
  if(action==='createClutch') {
    const d=z.object({pairId:required,startDate:actualDate,notes:text}).parse(data),p=pair(d.pairId);ensure(!p.endDate,'Este casal está encerrado.');ensure(d.startDate>=p.startDate,'A postura não pode anteceder a formação do casal.');ensure(!state.clutches.some(c=>c.scope===scope&&c.pairId===p.id&&!c.endDate),'Este casal já tem uma postura aberta.');const c={id:id(),scope,pairId:p.id,startDate:d.startDate,endDate:null,notes:d.notes};state.clutches.push(c);return {id:c.id};
  }
  if(action==='closeClutch') {
    const d=z.object({id:required,endDate:actualDate}).parse(data),c=clutch(d.id);ensure(!c.endDate,'Postura já encerrada.');ensure(d.endDate>=c.startDate,'Data anterior ao início da postura.');const es=state.eggs.filter(e=>e.scope===scope&&e.clutchId===c.id);ensure(!es.some(e=>e.status==='incubando'),'Registre o resultado dos ovos em acompanhamento antes de encerrar.');ensure(es.every(e=>(e.outcomeDate||e.hatchDate||e.laidDate)<=d.endDate&&(e.events??[]).every(event=>event.date<=d.endDate)),'Data anterior ao último evento da postura.');c.endDate=d.endDate;return {id:c.id};
  }
  if(action==='createEgg') {
    const d=z.object({clutchId:required,laidDate:actualDate,incubationDate:optionalDate,expectedHatchDate:z.union([date,z.literal('')]).default(''),fertility:z.enum(['desconhecida','fértil','infértil']).default('desconhecida'),notes:text}).parse(data),c=clutch(d.clutchId);ensure(!c.endDate,'Esta postura está encerrada.');ensure(d.laidDate>=c.startDate,'O ovo não pode anteceder o início da postura.');ensure(!d.incubationDate||d.incubationDate>=d.laidDate,'A incubação não pode anteceder a postura do ovo.');ensure(!d.expectedHatchDate||d.expectedHatchDate>=(d.incubationDate||d.laidDate),'A previsão não pode anteceder a postura ou a incubação.');const estimate=state.settings.speciesEstimates[bird(pair(c.pairId).maleId).species];let expected=d.expectedHatchDate;
    if(!expected&&estimate&&Number.isInteger(estimate)&&estimate>0&&estimate<=120) {const dt=new Date((d.incubationDate||d.laidDate)+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+estimate);expected=dt.toISOString().slice(0,10);}
    const events=[{date:d.laidDate,kind:'postura',notes:d.notes}];
    if(d.incubationDate)events.push({date:d.incubationDate,kind:'início da incubação',notes:''});
    if(d.fertility!=='desconhecida')events.push({date:today(),kind:'fertilidade: '+d.fertility,notes:d.notes});
    const e={...d,id:id(),scope,number:Math.max(0,...state.eggs.filter(e=>e.scope===scope&&e.clutchId===c.id).map(e=>e.number))+1,status:'incubando',hatchDate:null,chickId:null,expectedHatchDate:expected,outcomeDate:null,events};state.eggs.push(e);return {id:e.id};
  }
  if(action==='saveEgg'||action==='eggOutcome') {
    const d=z.object({id:required,status:z.enum(['incubando','infértil','perdido']).optional(),fertility:z.enum(['desconhecida','fértil','infértil']).optional(),incubationDate:optionalDate.optional(),expectedHatchDate:z.union([date,z.literal('')]).optional(),notes:text.optional(),eventDate:actualDate.optional()}).parse(data),e=egg(d.id);
    ensure(!clutch(e.clutchId).endDate,'Esta postura está encerrada.');
    ensure(!d.status||e.status!=='eclodido','Uma eclosão registrada deve ser preservada.');
    ensure(!d.fertility||d.fertility==='fértil'||e.status!=='eclodido','A fertilidade informada conflita com a eclosão registrada.');
    ensure((d.status??e.status)!=='infértil'||!d.fertility||d.fertility==='infértil','O resultado infértil precisa de avaliação de fertilidade compatível.');
    ensure(d.status!=='incubando'||e.status==='incubando'||!!d.notes,'Informe o motivo para reabrir o acompanhamento deste ovo.');
    const inc=d.incubationDate??e.incubationDate,exp=d.expectedHatchDate??e.expectedHatchDate,eventDate=d.eventDate??today();
    ensure(eventDate>=e.laidDate,'O evento não pode anteceder a postura do ovo.');
    ensure(!inc||inc>=e.laidDate,'A incubação não pode anteceder a postura do ovo.');
    ensure(!inc||!e.hatchDate||inc<=e.hatchDate,'A incubação não pode ser posterior à eclosão.');
    ensure(!exp||exp>=(inc||e.laidDate),'A previsão não pode anteceder a postura ou a incubação.');
    ensure(!d.status||d.status==='incubando'||!inc||eventDate>=inc,'O resultado não pode anteceder a incubação.');
    const events=[...(e.events??[])],statusChanged=!!d.status&&d.status!==e.status;
    if(d.fertility&&d.fertility!==e.fertility)events.push({date:eventDate,kind:'fertilidade: '+d.fertility,notes:d.notes??''});
    if(d.status&&d.status!==e.status)events.push({date:eventDate,kind:'resultado: '+d.status,notes:d.notes??''});
    if(d.incubationDate!==undefined&&inc!==e.incubationDate)events.push({date:inc||eventDate,kind:inc?'início da incubação corrigido':'incubação não informada',notes:d.notes??''});
    if(d.notes!==undefined&&d.notes!==e.notes)events.push({date:eventDate,kind:'observação',notes:d.notes});
    const {eventDate:_,...fields}=d;const updates=Object.fromEntries(Object.entries(fields).filter(([,v])=>v!==undefined));
    Object.assign(e,{...updates,id:e.id,incubationDate:inc,expectedHatchDate:exp,events});
    if(statusChanged)e.outcomeDate=d.status==='incubando'?null:eventDate;
    if(d.status==='infértil')e.fertility='infértil';return {id:e.id};
  }
  if(action==='hatchEgg') {
    const d=z.object({eggId:required,hatchDate:actualDate,identification:required,name:text,mutation:required,notes:text}).parse(data),e=egg(d.eggId);ensure(e.status==='incubando'&&!e.chickId,'Este ovo já tem resultado. A eclosão só pode ser registrada uma vez.');ensure(e.fertility!=='infértil','A fertilidade informada é incompatível com a eclosão. Corrija a avaliação primeiro.');const c=clutch(e.clutchId),p=pair(c.pairId);ensure(!c.endDate,'Postura encerrada.');ensure(d.hatchDate>=(e.incubationDate||e.laidDate),'A eclosão não pode anteceder a postura ou a incubação.');
    const result=breedingHandler(state,scope,'saveBird',{identification:d.identification,name:d.name,species:bird(p.maleId).species,sex:'indeterminado',mutation:d.mutation,certainty:'observada',origin:'Nascimento no criatório',notes:d.notes,birthDate:d.hatchDate,fatherId:p.maleId,motherId:p.femaleId,status:'filhote',statusDate:d.hatchDate,sexDate:d.hatchDate,mutationDate:d.hatchDate,enclosure:p.enclosure,mutationSource:'Observação no nascimento'});ensure(result?.id,'Não foi possível cadastrar o filhote.');e.status='eclodido';e.fertility='fértil';e.chickId=result.id;e.hatchDate=d.hatchDate;e.outcomeDate=d.hatchDate;e.events=[...(e.events??[]),{date:d.hatchDate,kind:'eclosão',notes:d.notes}];return result;
  }
  if(action==='saveHealth') {
    const d=z.object({id:required.optional(),birdId:required,date:actualDate,kind:required,title:required,notes:text,weightGrams:z.number().positive().max(100000).nullable().default(null),professional:text,author:required,attachmentIds:z.array(required).max(30).default([])}).parse(data),b=bird(d.birdId);ensure(!b.birthDate||d.date>=b.birthDate,'O registro não pode anteceder o nascimento.');if(d.kind==='pesagem')ensure(d.weightGrams!==null,'Informe o peso em gramas.');for(const a of d.attachmentIds)attachment(state,scope,a,b.id);const existing=d.id?state.health.find(h=>h.id===d.id&&h.scope===scope):undefined;ensure(!d.id||existing,'Registro de saúde não encontrado neste espaço.');ensure(!existing||existing.birdId===b.id,'O registro pertence a outra ave.');const record={...d,id:existing?.id??id(),scope};if(existing)state.health[state.health.indexOf(existing)]=record;else state.health.push(record);return {id:record.id};
  }
  if(action==='saveTask') {
    const d=z.object({id:required.optional(),birdId:optionalId,title:required,dueDate:date,done:z.boolean().default(false),notes:text,reminderTime:z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),z.literal('')]).optional(),reminderMinutes:z.union([z.literal(0),z.literal(5),z.literal(15),z.literal(30),z.literal(60),z.literal(1440)]).optional()}).parse(data);if(d.birdId)bird(d.birdId);const existing=d.id?state.tasks.find(t=>t.id===d.id&&t.scope===scope):undefined;ensure(!d.id||existing,'Tarefa não encontrada neste espaço.');const updates=Object.fromEntries(Object.entries(d).filter(([,v])=>v!==undefined));const record={...existing,...updates,...d,id:existing?.id??id(),scope,reminderTime:d.reminderTime??existing?.reminderTime,reminderMinutes:d.reminderMinutes??existing?.reminderMinutes};if(existing)state.tasks[state.tasks.indexOf(existing)]=record;else state.tasks.push(record);return {id:record.id};
  }
  if(action==='toggleTask') {const d=z.object({id:required,done:z.boolean()}).parse(data),t=state.tasks.find(t=>t.id===d.id&&t.scope===scope);ensure(t,'Tarefa não encontrada neste espaço.');t.done=d.done;return {id:t.id};}
  return null;
};

export const birdStatusOptions:readonly BirdStatus[]=statuses;

export function healthHistoryForBird(state:State,scope:Scope,birdId:string) {
  return state.health.map((record,index)=>({record,index})).filter(({record})=>record.scope===scope&&record.birdId===birdId).sort((a,b)=>b.record.date.localeCompare(a.record.date)||b.index-a.index).map(({record})=>record);
}

export function latestBirdWeight(state:State,scope:Scope,birdId:string) {
  return healthHistoryForBird(state,scope,birdId).find(record=>record.weightGrams!==null);
}
