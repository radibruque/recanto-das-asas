import { z } from 'zod';
import { database, snapshot } from '../../../db/store';
import { initializeDemo } from '../../../db/demo';
import { today, related } from '../../../lib/model';
class InputError extends Error {}
function ensure(v:unknown,message:string):asserts v {if(!v)throw new InputError(message);}
const text=z.string().trim().max(2000), required=z.string().trim().min(1).max(150);
const scopeSchema=z.enum(['real','demo']);
const date=z.string().refine(v=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return !isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v;},'Data inválida.');
const actualDate=date.refine(v=>v<=today(),'A data não pode estar no futuro.');
const birdSchema=z.object({identification:required,name:text.default(''),species:required,sex:z.enum(['macho','fêmea','indeterminado']),mutation:required,certainty:z.enum(['observada','informada','confirmada']),carriers:text.default(''),origin:required,notes:text.default(''),birthDate:z.union([actualDate,z.literal('')]).default(''),fatherId:z.string().nullable().default(null),motherId:z.string().nullable().default(null)});
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request) {try {return response(await snapshot(scopeSchema.parse(new URL(request.url).searchParams.get('scope'))));}catch(e){return failure(e);}}
export async function POST(request:Request) {
 try {
  const origin=request.headers.get('origin');ensure(!origin||origin===new URL(request.url).origin,'Origem da solicitação não permitida.');
  ensure(request.headers.get('x-recanto-action')==='1','Solicitação inválida.');ensure(request.headers.get('content-type')?.includes('application/json'),'Formato inválido.');
  const payload=await request.json() as Record<string,unknown>;const scope=scopeSchema.parse(payload.scope),action=required.parse(payload.action),data=payload.data ?? {};
  if(action==='initializeDemo'){ensure(scope==='demo','A demonstração deve usar seu espaço próprio.');await initializeDemo();return response({snapshot:await snapshot(scope)});}
  const s=await snapshot(scope),db=database(),id=crypto.randomUUID(),now=new Date().toISOString();
  const bird=(id:string)=>{const b=s.birds.find(b=>b.id===id);ensure(b,'Ave não encontrada neste espaço.');return b;};
  const pair=(id:string)=>{const p=s.pairs.find(p=>p.id===id);ensure(p,'Casal não encontrado neste espaço.');return p;};
  const clutch=(id:string)=>{const c=s.clutches.find(c=>c.id===id);ensure(c,'Postura não encontrada neste espaço.');return c;};let resultId=id;
  if(action==='saveBird'){
   const d=birdSchema.extend({id:z.string().optional()}).parse(data),existing=d.id?bird(d.id):null;resultId=existing?.id??id;
   ensure(!s.birds.some(b=>b.id!==resultId&&b.identification.toLocaleLowerCase('pt-BR')===d.identification.toLocaleLowerCase('pt-BR')),'Esta identificação já está cadastrada.');
   if(existing){const linked=s.pairs.some(p=>p.maleId===existing.id||p.femaleId===existing.id)||s.birds.some(b=>b.fatherId===existing.id||b.motherId===existing.id);
    ensure(!linked||(existing.species===d.species&&existing.sex===d.sex),'Espécie e sexo de uma ave vinculada a casais ou descendentes devem ser preservados.');
    ensure(!s.eggs.some(e=>e.chickId===existing.id)||(d.fatherId===existing.fatherId&&d.motherId===existing.motherId&&d.birthDate===existing.birthDate&&d.species===existing.species),'Os pais, a espécie e o nascimento deste filhote estão vinculados à eclosão.');
   }
   ensure(!d.birthDate||s.birds.filter(b=>b.fatherId===resultId||b.motherId===resultId).every(b=>!b.birthDate||d.birthDate<b.birthDate),'O nascimento desta ave deve anteceder o de seus descendentes.');
   const parents=[d.fatherId,d.motherId].filter(Boolean) as string[];ensure(!parents.includes(resultId),'Uma ave não pode ser seu próprio ancestral.');
   for(const parentId of parents){const p=bird(parentId);ensure(p.species===d.species,'Os pais devem ser da mesma espécie.');
    const walk=(pid:string,seen=new Set<string>()):boolean=>{if(pid===resultId)return true;if(seen.has(pid))return false;seen.add(pid);const q=s.birds.find(b=>b.id===pid);return !!q&&[q.fatherId,q.motherId].some(x=>x?walk(x,seen):false);};
    ensure(!walk(parentId),'Este vínculo criaria um ciclo de parentesco.');ensure(!d.birthDate||!p.birthDate||p.birthDate<d.birthDate,'O nascimento do filhote deve ser posterior ao dos pais.');
   }
   if(d.fatherId)ensure(bird(d.fatherId).sex==='macho','O pai precisa ter sexo registrado como macho.');if(d.motherId)ensure(bird(d.motherId).sex==='fêmea','A mãe precisa ter sexo registrado como fêmea.');
   const values=[d.identification,d.name,d.species,d.sex,d.mutation,d.certainty,d.carriers,d.origin,d.notes,d.birthDate,d.fatherId,d.motherId];
   const stmts=[existing?db.prepare('UPDATE birds SET identification=?,name=?,species=?,sex=?,mutation=?,certainty=?,carriers=?,origin=?,notes=?,birth_date=?,father_id=?,mother_id=? WHERE id=? AND scope=?').bind(...values,resultId,scope):db.prepare('INSERT INTO birds (identification,name,species,sex,mutation,certainty,carriers,origin,notes,birth_date,father_id,mother_id,id,scope,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...values,resultId,scope,now)];
   if(!existing||existing.mutation!==d.mutation||existing.certainty!==d.certainty||existing.carriers!==d.carriers)stmts.push(db.prepare('INSERT INTO mutation_history VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),scope,resultId,d.mutation,d.certainty,d.carriers,now));await db.batch(stmts);
  }else if(action==='createPair'){
   const d=z.object({name:required,maleId:required,femaleId:required,startDate:actualDate,notes:text.default(''),acknowledgeRelated:z.boolean().default(false)}).parse(data),m=bird(d.maleId),f=bird(d.femaleId);
   ensure(m.id!==f.id&&m.sex==='macho'&&f.sex==='fêmea','Selecione um macho e uma fêmea distintos.');ensure(m.species===f.species,'As aves precisam ser da mesma espécie.');ensure(!s.pairs.some(p=>!p.endDate&&(p.maleId===m.id||p.femaleId===f.id)),'Uma das aves já pertence a um casal ativo.');
   ensure((!m.birthDate||m.birthDate<=d.startDate)&&(!f.birthDate||f.birthDate<=d.startDate),'A formação do casal não pode anteceder o nascimento das aves.');if(related(m,f,s.birds))ensure(d.acknowledgeRelated,'Há parentesco conhecido. Confirme que deseja registrar esse casal.');
   await db.prepare('INSERT INTO pairs VALUES (?,?,?,?,?,?,NULL,?)').bind(id,scope,d.name,m.id,f.id,d.startDate,d.notes).run();
  }else if(action==='closePair'){
   const d=z.object({id:required,endDate:actualDate}).parse(data),p=pair(d.id);ensure(!p.endDate,'Este casal já foi encerrado.');ensure(d.endDate>=p.startDate,'Data anterior à formação do casal.');ensure(!s.clutches.some(c=>c.pairId===p.id&&!c.endDate),'Encerre as posturas abertas antes de encerrar o casal.');ensure(s.clutches.filter(c=>c.pairId===p.id).every(c=>!c.endDate||c.endDate<=d.endDate),'A data deve ser posterior ao encerramento das posturas.');
   await db.prepare('UPDATE pairs SET end_date=? WHERE id=? AND scope=?').bind(d.endDate,p.id,scope).run();resultId=p.id;
  }else if(action==='createClutch'){
   const d=z.object({pairId:required,startDate:actualDate,notes:text.default('')}).parse(data),p=pair(d.pairId);ensure(!p.endDate,'Este casal está encerrado.');ensure(d.startDate>=p.startDate,'A postura não pode anteceder a formação do casal.');ensure(!s.clutches.some(c=>c.pairId===p.id&&!c.endDate),'Este casal já tem uma postura aberta.');await db.prepare('INSERT INTO clutches VALUES (?,?,?,?,NULL,?)').bind(id,scope,p.id,d.startDate,d.notes).run();
  }else if(action==='closeClutch'){
   const d=z.object({id:required,endDate:actualDate}).parse(data),c=clutch(d.id);ensure(!c.endDate,'Postura já encerrada.');ensure(d.endDate>=c.startDate,'Data anterior ao início da postura.');const es=s.eggs.filter(e=>e.clutchId===c.id);ensure(!es.some(e=>e.status==='incubando'),'Registre o resultado dos ovos em incubação antes de encerrar.');ensure(es.every(e=>(e.hatchDate||e.laidDate)<=d.endDate),'Data anterior ao último evento da postura.');await db.prepare('UPDATE clutches SET end_date=? WHERE id=? AND scope=?').bind(d.endDate,c.id,scope).run();resultId=c.id;
  }else if(action==='createEgg'){
   const d=z.object({clutchId:required,laidDate:actualDate,notes:text.default('')}).parse(data),c=clutch(d.clutchId);ensure(!c.endDate,'Esta postura está encerrada.');ensure(d.laidDate>=c.startDate,'O ovo não pode anteceder o início da postura.');const n=Math.max(0,...s.eggs.filter(e=>e.clutchId===c.id).map(e=>e.number))+1;await db.prepare('INSERT INTO eggs VALUES (?,?,?,?,?,?,NULL,NULL,?)').bind(id,scope,c.id,n,d.laidDate,'incubando',d.notes).run();
  }else if(action==='eggOutcome'){
   const d=z.object({id:required,status:z.enum(['incubando','infértil','perdido']),notes:text.default('')}).parse(data),e=s.eggs.find(e=>e.id===d.id);ensure(e,'Ovo não encontrado.');ensure(e.status!=='eclodido','Uma eclosão registrada deve ser preservada.');ensure(!clutch(e.clutchId).endDate,'Esta postura está encerrada.');await db.prepare('UPDATE eggs SET status=?,notes=? WHERE id=? AND scope=? AND chick_id IS NULL').bind(d.status,d.notes,e.id,scope).run();resultId=e.id;
  }else if(action==='hatchEgg'){
   const d=z.object({eggId:required,hatchDate:actualDate,identification:required,name:text.default(''),mutation:required,notes:text.default('')}).parse(data),e=s.eggs.find(e=>e.id===d.eggId);ensure(e,'Ovo não encontrado.');ensure(e.status==='incubando'&&!e.chickId,'Somente um ovo em incubação pode registrar eclosão.');const c=clutch(e.clutchId),p=pair(c.pairId);ensure(!c.endDate,'Postura encerrada.');ensure(d.hatchDate>=e.laidDate,'A eclosão não pode anteceder a postura do ovo.');ensure(!s.birds.some(b=>b.identification.toLocaleLowerCase('pt-BR')===d.identification.toLocaleLowerCase('pt-BR')),'Esta identificação já está cadastrada.');
   await db.batch([
    db.prepare('INSERT INTO birds (id,scope,identification,name,species,sex,mutation,certainty,carriers,origin,notes,birth_date,father_id,mother_id,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM eggs WHERE id=? AND status=? AND chick_id IS NULL)').bind(id,scope,d.identification,d.name,bird(p.maleId).species,'indeterminado',d.mutation,'observada','','Nascimento no criatório',d.notes,d.hatchDate,p.maleId,p.femaleId,now,e.id,'incubando'),
    db.prepare('INSERT INTO mutation_history SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM birds WHERE id=?)').bind(crypto.randomUUID(),scope,id,d.mutation,'observada','',now,id),
    db.prepare('UPDATE eggs SET status=?,hatch_date=?,chick_id=? WHERE id=? AND scope=? AND status=? AND chick_id IS NULL AND EXISTS (SELECT 1 FROM birds WHERE id=?)').bind('eclodido',d.hatchDate,id,e.id,scope,'incubando',id),
   ]);ensure(await db.prepare('SELECT id FROM birds WHERE id=?').bind(id).first(),'Este ovo já foi atualizado. Recarregue os registros.');
  }else throw new InputError('Ação desconhecida.');return response({id:resultId,snapshot:await snapshot(scope)});
 }catch(e){return failure(e);}
}
function failure(e:unknown){
 if(e instanceof z.ZodError)return response({error:e.issues.find(x=>x.message.includes('data')||x.message.includes('Data'))?.message||'Confira os campos obrigatórios e as datas.'},400);
 if(e instanceof InputError)return response({error:e.message},400);if(e instanceof SyntaxError)return response({error:'Solicitação inválida.'},400);
 console.error('Recanto storage failure',e);if(e instanceof Error&&e.message.includes('UNIQUE constraint'))return response({error:'Este registro já existe ou uma das aves já está vinculada. Recarregue e confira os dados.'},409);
 return response({error:'Não foi possível acessar os registros. Seus campos foram preservados; tente novamente.'},503);
}
