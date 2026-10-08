import { required, date } from '../domain/shared';
import type { State, Scope } from '../domain/types';
export const columns=['identificacao','nome','especie','sexo','mutacao','origem','nascimento','pai','mae'];
export const importTemplate=columns.join(';')+'\r\n';
export function parseCSV(text:string):string[][] {
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(!quoted&&cell){throw new Error('Aspas inválidas no CSV.');}else quoted=!quoted;}else if(c===';'&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw new Error('Campo entre aspas não foi fechado.');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;
}
export function previewImport(csv:string,state:State,scope:Scope){
 if(csv.length>5*1024*1024)throw new Error('Planilha acima de 5 MB.');
 const rows=parseCSV(csv.replace(/^\uFEFF/,''));if(!rows.length||rows[0].join(';')!==columns.join(';'))throw new Error('Use as colunas do modelo CSV, na mesma ordem.');
 if(rows.length>5001)throw new Error('Importe no máximo 5.000 aves por arquivo.');
 const seen=new Set(state.birds.filter(b=>b.scope===scope).map(b=>b.identification.toLocaleLowerCase('pt-BR')));
 const preview=rows.slice(1).map((values,index)=>{const r=Object.fromEntries(columns.map((c,i)=>[c,(values[i]??'').trim()]));const errors:string[]=[];if(values.length!==columns.length)errors.push('Número de colunas incorreto');for(const k of ['identificacao','especie','mutacao','origem'])if(!required.safeParse(r[k]).success)errors.push('Campo inválido: '+k);if(!['macho','fêmea','indeterminado'].includes(r.sexo))errors.push('Sexo inválido');if(r.nascimento&&!date.safeParse(r.nascimento).success)errors.push('Nascimento inválido');const normalized=r.identificacao.toLocaleLowerCase('pt-BR');if(seen.has(normalized))errors.push('Identificação duplicada');seen.add(normalized);return {line:index+2,values:r,errors};});
 const identifiers=new Set([...state.birds.filter(b=>b.scope===scope).map(b=>b.identification),...preview.map(r=>r.values.identificacao)]);
 for(const r of preview)for(const col of ['pai','mae'])if(r.values[col]&&!identifiers.has(r.values[col]))r.errors.push('Ancestral não encontrado: '+r.values[col]);
 return preview;
}
