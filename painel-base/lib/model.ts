export type Scope = 'real' | 'demo';
export type Bird = {id:string; scope:Scope; identification:string; name:string; species:string; sex:string; mutation:string; certainty:string; carriers:string; origin:string; notes:string; birthDate:string; fatherId:string|null; motherId:string|null; createdAt:string};
export type Pair = {id:string; scope:Scope; name:string; maleId:string; femaleId:string; startDate:string; endDate:string|null; notes:string};
export type Clutch = {id:string; scope:Scope; pairId:string; startDate:string; endDate:string|null; notes:string};
export type Egg = {id:string; scope:Scope; clutchId:string; number:number; laidDate:string; status:string; hatchDate:string|null; chickId:string|null; notes:string};
export type MutationEntry = {id:string; scope:Scope; birdId:string; mutation:string; certainty:string; carriers:string; recordedAt:string};
export type Snapshot = {birds:Bird[]; pairs:Pair[]; clutches:Clutch[]; eggs:Egg[]; mutations:MutationEntry[]};
export const blankSnapshot:Snapshot = {birds:[],pairs:[],clutches:[],eggs:[],mutations:[]};
export const speciesOptions = ['Calopsita (Nymphicus hollandicus)', 'Periquito-australiano (Melopsittacus undulatus)', 'Agapornis roseicollis', 'Agapornis fischeri', 'Agapornis personatus', 'Ringneck (Psittacula krameri)'];
export const birdLabel = (b?:Bird) => b ? (b.name ? `${b.name} · ${b.identification}` : b.identification) : 'Não informado';
export const shortSpecies = (s:string) => s.split(' (')[0];
export const dateLabel = (s?:string|null) => s ? new Date(s.slice(0,10)+'T12:00:00Z').toLocaleDateString('pt-BR',{timeZone:'UTC'}) : 'Não informada';
export const today = () => new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
export const related = (a:Bird,b:Bird, birds:Bird[]) => {
 const ancestors = (bird:Bird, seen=new Set<string>()) => { for(const id of [bird.fatherId,bird.motherId]) { if(id && !seen.has(id)){seen.add(id); const p=birds.find(x=>x.id===id); if(p) ancestors(p,seen);} } return seen; };
 const x=ancestors(a), y=ancestors(b); return x.has(b.id)||y.has(a.id)||[...x].some(id=>y.has(id));
};
