import { speciesOptions } from './base-model';
import { newSpecies } from './species';

const isRecord=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);

/** Pure, repeatable migration. Existing IDs, bytes, dates, exact names and records remain unchanged. */
export function migrateState(value:unknown):unknown {
 if(!isRecord(value)||![1,2].includes(value.schemaVersion as number))return value;
 const next=structuredClone(value);
 if(!isRecord(next.settings)||!Array.isArray(next.birds)||!Array.isArray(next.tasks))return value;
 const settings=next.settings;
 const estimates=isRecord(settings.speciesEstimates)?settings.speciesEstimates:{};
 const names=new Set<string>(speciesOptions);
 for(const name of Object.keys(estimates))names.add(name);
 for(const bird of next.birds)if(isRecord(bird)&&typeof bird.species==='string')names.add(bird.species);
 const catalog=[...names].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(name=>newSpecies(name,typeof estimates[name]==='number'?estimates[name] as number:null));
 settings.speciesCatalog=catalog;
 for(const entry of catalog)if(entry.incubationDays!==null)entry.parameterSource='Fonte não informada na versão anterior; revisar antes de usar parâmetros novos.';
 settings.derivedTaskRules={hatch:false,eggCheck:false,chickFollowup:false};
 for(const bird of next.birds)if(isRecord(bird)&&typeof bird.species==='string')bird.speciesId=catalog.find(s=>s.name===bird.species)?.id;
 if(Array.isArray(next.eggs))for(const egg of next.eggs)if(isRecord(egg)&&!egg.expectedHatchSource)egg.expectedHatchSource=egg.expectedHatchDate?'legacy':'species';
 for(const task of next.tasks)if(isRecord(task)){task.origin='manual';task.history=[];}
 next.purchases=[];
 next.schemaVersion=3;
 return next;
}
