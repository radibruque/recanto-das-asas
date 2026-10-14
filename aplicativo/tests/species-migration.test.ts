import { describe,expect,it } from 'vitest';
import { applyCommand } from '../src/domain/engine';
import { emptyState } from '../src/domain/types';
import { validateState } from '../src/lib/validation';
import { migrateState } from '../src/domain/migrations';
import { speciesIdForName } from '../src/domain/species';
function oldFixture(){
 const current=emptyState();const id=applyCommand(current,'real','saveBird',{identification:'AVE-REAL-QA',species:'Calopsita',sex:'indeterminado',mutation:'Não informada',certainty:'informada',origin:'Fonte informada'})!;
 applyCommand(current,'real','saveTask',{birdId:id,title:'Tarefa antiga',dueDate:'2026-10-01',done:true});
 const old=JSON.parse(JSON.stringify(current));old.schemaVersion=2;delete old.purchases;delete old.settings.speciesCatalog;delete old.settings.derivedTaskRules;delete old.birds[0].speciesId;delete old.tasks[0].origin;delete old.tasks[0].history;
 old.settings.speciesEstimates={'Calopsita':22,'calopsita':24,'Espécie grafia original':30};return old;
}
describe('migração versionada sem inferência de espécies',()=>{
 it('preserves exact spellings, estimates, records, scopes, old completion and IDs while adding stable metadata',()=>{
  const old=oldFixture(),before=JSON.parse(JSON.stringify(old));const state=validateState(old);
  expect(old).toEqual(before);expect(state.schemaVersion).toBe(3);expect(state.purchases).toEqual([]);expect(state.settings.speciesEstimates).toEqual(before.settings.speciesEstimates);
  expect(state.birds[0]).toEqual({...before.birds[0],speciesId:speciesIdForName('Calopsita')});expect(state.tasks[0]).toEqual({...before.tasks[0],origin:'manual',history:[]});
  const variants=state.settings.speciesCatalog.filter(s=>['Calopsita','calopsita'].includes(s.name));expect(variants).toHaveLength(2);expect(new Set(variants.map(s=>s.id)).size).toBe(2);expect(variants.map(s=>s.incubationDays).sort()).toEqual([22,24]);
  expect(state.settings.derivedTaskRules).toEqual({hatch:false,eggCheck:false,chickFollowup:false});expect(state.settings.speciesCatalog.find(s=>s.name==='Espécie grafia original')?.incubationDays).toBe(30);
 });
 it('is repeatable and compatible with versions 1 and 2 but rejects future schemas and invalid source versions',()=>{
  const state=validateState(oldFixture());expect(validateState(state)).toEqual(state);expect(migrateState(state)).toBe(state);
  const one=oldFixture();one.schemaVersion=1;expect(validateState(one).schemaVersion).toBe(3);
  for(const version of ['2',4,0]){const old=oldFixture();old.schemaVersion=version;expect(()=>validateState(old)).toThrow(/incompatível/);}
 });
 it('rejects malformed schema 3 without replacing missing data with defaults',()=>{
  const state=emptyState();delete (state as unknown as Record<string,unknown>).purchases;expect(()=>validateState(state)).toThrow(/purchases/);
 });
 it('preserves old explicit forecasts and only fills an absent forecast after the user configures parameters',()=>{
  const current=emptyState();
  const bird=(identification:string,sex:string)=>applyCommand(current,'real','saveBird',{identification,sex,species:'Calopsita',mutation:'Não informada',certainty:'informada',origin:'Origem QA'})!;
  const maleId=bird('M-QA','macho'),femaleId=bird('F-QA','fêmea');
  const pairId=applyCommand(current,'real','createPair',{name:'Casal QA',maleId,femaleId,startDate:'2024-01-01'})!;
  const clutchId=applyCommand(current,'real','createClutch',{pairId,startDate:'2024-01-10'})!;
  applyCommand(current,'real','createEgg',{clutchId,laidDate:'2024-01-11'});
  applyCommand(current,'real','createEgg',{clutchId,laidDate:'2024-01-12',expectedHatchDate:'2024-02-15'});
  const old=JSON.parse(JSON.stringify(current));old.schemaVersion=2;delete old.purchases;delete old.settings.speciesCatalog;delete old.settings.derivedTaskRules;for(const egg of old.eggs)delete egg.expectedHatchSource;
  const state=validateState(old);expect(state.eggs.map(e=>e.expectedHatchDate)).toEqual(['','2024-02-15']);expect(state.eggs.map(e=>e.expectedHatchSource)).toEqual(['species','legacy']);
  applyCommand(state,'real','species.save',{id:state.birds[0].speciesId,name:'Calopsita',incubationDays:22,eggCheckDays:null,chickFollowupDays:null,parameterSource:'Referência validada informada no teste',active:true});
  expect(state.eggs.map(e=>e.expectedHatchDate)).toEqual(['2024-02-02','2024-02-15']);
 });
 it('preserves legacy unsupported estimates as invalid instead of making them valid during migration',()=>{
  const old=oldFixture();old.settings.speciesEstimates.Calopsita='não numérico';expect(()=>validateState(old)).toThrow(/incompatível/);
 });
 it('requires an explicit source for any new or changed configured parameter and permits null values',()=>{
  const state=emptyState(),payload={name:'Espécie QA',incubationDays:null,eggCheckDays:null,chickFollowupDays:null,parameterSource:'',active:true};
  const id=applyCommand(state,'real','species.save',payload)!;expect(()=>applyCommand(state,'real','species.save',{...payload,id,incubationDays:22})).toThrow(/fonte/);
  applyCommand(state,'real','species.save',{...payload,id,incubationDays:22,parameterSource:'Referência validada informada no teste'});expect(state.settings.speciesCatalog.find(entry=>entry.id===id)!.incubationDays).toBe(22);expect(validateState(state).settings.speciesCatalog.find(entry=>entry.id===id)!.name).toBe('Espécie QA');
 });
 it('renames a catalog item explicitly without altering original bird strings or losing estimates and links',()=>{
  const state=validateState(oldFixture()),id=state.birds[0].speciesId!;
  applyCommand(state,'real','species.save',{id,name:'Calopsita (nome revisado)',incubationDays:22,eggCheckDays:null,chickFollowupDays:null,parameterSource:'',active:true});
  expect(state.birds[0].species).toBe('Calopsita');expect(state.birds[0].speciesId).toBe(id);expect(state.settings.speciesCatalog.find(s=>s.id===id)?.aliases).toContain('Calopsita');expect(state.settings.speciesEstimates.Calopsita).toBe(22);expect(validateState(state).birds[0].speciesId).toBe(id);
 });
 it('allows reproduction between explicitly renamed catalog aliases without merging unrelated spellings',()=>{
  const state=emptyState();const add=(identification:string,species:string,sex:string)=>applyCommand(state,'real','saveBird',{identification,species,sex,mutation:'Não informada',certainty:'informada',origin:'Origem QA'})!;
  const maleId=add('M-ALIASES','Espécie QA original','macho'),speciesId=state.birds[0].speciesId!;
  applyCommand(state,'real','species.save',{id:speciesId,name:'Espécie QA nome atual',incubationDays:null,eggCheckDays:null,chickFollowupDays:null,parameterSource:'',active:true});
  const femaleId=add('F-ALIASES','Espécie QA nome atual','fêmea');
  const pairId=applyCommand(state,'real','createPair',{name:'Casal aliases explícitos',maleId,femaleId,startDate:'2024-01-01'})!;
  const clutchId=applyCommand(state,'real','createClutch',{pairId,startDate:'2024-01-10'})!;
  const eggId=applyCommand(state,'real','createEgg',{clutchId,laidDate:'2024-01-11'})!;
  const chickId=applyCommand(state,'real','hatchEgg',{eggId,hatchDate:'2024-02-01',identification:'FILHOTE-ALIASES',mutation:'Não informada'})!;
  expect(state.birds.find(b=>b.id===chickId)).toMatchObject({fatherId:maleId,motherId:femaleId,species:'Espécie QA original',speciesId});expect(validateState(state).birds[0].species).toBe('Espécie QA original');
  const uncertainMale=add('M-UNCERTAIN','espécie QA original','macho'),uncertainFemale=add('F-UNCERTAIN','Espécie QA nome atual','fêmea');
  expect(()=>applyCommand(state,'real','createPair',{name:'Não unificar grafias',maleId:uncertainMale,femaleId:uncertainFemale,startDate:'2024-01-01'})).toThrow(/mesma espécie/);
 });
 it('does not permit the retired JSON settings path to erase existing estimates',()=>{
  const state=validateState(oldFixture()),before=structuredClone(state.settings);expect(()=>applyCommand(state,'real','settings.save',{...state.settings,speciesEstimates:{}})).toThrow(/catálogo/);expect(state.settings).toEqual(before);
 });
 it('does not allow automatic merging, ambiguous aliases or unsupported parameter ranges',()=>{
  const state=validateState(oldFixture()),id=state.birds[0].speciesId!;
  const input={id,name:'calopsita',incubationDays:22,eggCheckDays:null,chickFollowupDays:null,parameterSource:'Fonte QA',active:true};expect(()=>applyCommand(state,'real','species.save',input)).toThrow(/nome exato/);
  expect(()=>applyCommand(state,'real','species.save',{...input,name:'Nome único',eggCheckDays:0})).toThrow();
  const corrupt=structuredClone(state);corrupt.settings.speciesCatalog[1].aliases.push(corrupt.settings.speciesCatalog[0].name);expect(()=>validateState(corrupt)).toThrow(/duplicada/);
 });
});
