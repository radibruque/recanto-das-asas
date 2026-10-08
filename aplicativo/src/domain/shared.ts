import { z } from 'zod';
export { today, dateLabel, birdLabel, related, speciesOptions } from './base-model';
export const id = () => crypto.randomUUID();
export const ensure: (condition:unknown,message:string)=>asserts condition = (condition,message) => {if(!condition) throw new Error(message);};
export const required = z.string().trim().min(1,'Preencha os campos obrigatórios.').max(150);
export const text = z.string().trim().max(2000).default('');
export const date = z.string().refine(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(new Date(v+'T12:00:00Z').valueOf())&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v,'Data inválida.');
export const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const money = (v:number)=> (v/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function parseMoney(value:string):number {const s=value.trim();ensure(/^(\d+|\d{1,3}(\.\d{3})+)(,\d{1,2})?$/.test(s),'Use um valor como 1.234,56.');const [whole,frac='']=s.replaceAll('.','').split(',');const result=Number(whole)*100+Number(frac.padEnd(2,'0'));ensure(Number.isSafeInteger(result),'Valor muito alto.');return result;}
export const moneyInput=(c:number)=>(c/100).toFixed(2).replace('.',',');
