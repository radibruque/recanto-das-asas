import { z } from 'zod';
import type { Bird, Handler, Species, State } from './types';
import { ensure, required, text } from './shared';

/** Stable local identifier; exact spellings intentionally remain separate. Not a security hash. */
export function speciesIdForName(name:string):string {
 const mask=(1n<<64n)-1n;
 const hash=(seed:bigint)=>{let h=seed;for(const byte of new TextEncoder().encode(name)){h^=BigInt(byte);h=(h*1099511628211n)&mask;}return h.toString(16).padStart(16,'0');};
 return 'species-'+hash(14695981039346656037n)+hash(7809847782465536322n);
}

export const newSpecies=(name:string,incubationDays:number|null=null):Species=>({id:speciesIdForName(name),name,aliases:[],incubationDays,eggCheckDays:null,chickFollowupDays:null,parameterSource:'',active:true});
export function speciesForBird(state:State,bird:Pick<Bird,'species'|'speciesId'>):Species|undefined {
 return state.settings.speciesCatalog.find(s=>s.id===bird.speciesId)??state.settings.speciesCatalog.find(s=>s.name===bird.species||s.aliases.includes(bird.species));
}
/** Only an explicit catalog rename shares an identity; uncertain spellings stay separate. */
export function sameSpecies(state:State,left:Pick<Bird,'species'|'speciesId'>,right:Pick<Bird,'species'|'speciesId'>):boolean {
 if(left.species===right.species)return true;
 const a=speciesForBird(state,left),b=speciesForBird(state,right);
 return !!a&&!!b&&a.id===b.id;
}
export function ensureBirdSpecies(state:State,bird:Pick<Bird,'species'|'speciesId'>):Species {
 let species=speciesForBird(state,bird);
 if(!species){species=newSpecies(bird.species,state.settings.speciesEstimates[bird.species]??null);state.settings.speciesCatalog.push(species);}
 bird.speciesId=species.id;return species;
}
export function incubationDaysForBird(state:State,bird:Pick<Bird,'species'|'speciesId'>):number|null {
 const species=speciesForBird(state,bird);
 if(species&&!species.active)return null;
 return species?species.incubationDays:state.settings.speciesEstimates[bird.species]??null;
}
const days=z.number().int().min(1).max(365).nullable();
export const speciesHandler:Handler=(state,scope,action,data)=>{
 if(action!=='species.save')return null;
 const input=z.object({id:required.optional(),name:required,incubationDays:days,eggCheckDays:days,chickFollowupDays:days,parameterSource:text,active:z.boolean().default(true)}).parse(data);
 const previous=input.id?state.settings.speciesCatalog.find(s=>s.id===input.id):undefined;
 ensure(!input.id||previous,'Espécie não encontrada no catálogo.');
 ensure(!state.settings.speciesCatalog.some(s=>s.id!==previous?.id&&(s.name===input.name||s.aliases.includes(input.name))),'Já existe uma espécie com este nome exato. Escolha o registro existente.');
 const changedParameter=(['incubationDays','eggCheckDays','chickFollowupDays'] as const).some(key=>input[key]!==null&&input[key]!==previous?.[key]);
 ensure(!changedParameter||input.parameterSource.trim(),'Informe a fonte dos parâmetros novos ou alterados. Nenhum prazo padrão será acrescentado.');
 const aliases=previous?[...previous.aliases]:[];
 if(previous&&previous.name!==input.name&&!aliases.includes(previous.name))aliases.push(previous.name);
 const species:Species={...input,id:previous?.id??speciesIdForName(input.name),aliases:aliases.filter(name=>name!==input.name)};
 ensure(!state.settings.speciesCatalog.some(s=>s.id===species.id&&s!==previous),'O identificador da espécie já está em uso. Preserve os registros e revise o catálogo.');
 if(previous)Object.assign(previous,species);else state.settings.speciesCatalog.push(species);
 // Keep legacy exact-name values for backups and traceability. The catalog is the source for new calculations.
 if(species.incubationDays!==null)for(const name of [species.name,...species.aliases])state.settings.speciesEstimates[name]=species.incubationDays;
 else for(const name of [species.name,...species.aliases])delete state.settings.speciesEstimates[name];
 return {id:species.id};
};
