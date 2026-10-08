import { env } from 'cloudflare:workers';
import type { Snapshot, Scope } from '../lib/model';
export function database(): D1Database { if(!env.DB) throw new Error('Banco indisponível'); return env.DB; }
export async function snapshot(scope:Scope):Promise<Snapshot> {
 const db=database(); const result=await db.batch([
 db.prepare('SELECT id,scope,identification,name,species,sex,mutation,certainty,carriers,origin,notes,birth_date AS birthDate,father_id AS fatherId,mother_id AS motherId,created_at AS createdAt FROM birds WHERE scope=? ORDER BY created_at DESC, identification').bind(scope),
 db.prepare('SELECT id,scope,name,male_id AS maleId,female_id AS femaleId,start_date AS startDate,end_date AS endDate,notes FROM pairs WHERE scope=? ORDER BY start_date DESC').bind(scope),
 db.prepare('SELECT id,scope,pair_id AS pairId,start_date AS startDate,end_date AS endDate,notes FROM clutches WHERE scope=? ORDER BY start_date DESC').bind(scope),
 db.prepare('SELECT id,scope,clutch_id AS clutchId,number,laid_date AS laidDate,status,hatch_date AS hatchDate,chick_id AS chickId,notes FROM eggs WHERE scope=? ORDER BY laid_date,number').bind(scope),
 db.prepare('SELECT id,scope,bird_id AS birdId,mutation,certainty,carriers,recorded_at AS recordedAt FROM mutation_history WHERE scope=? ORDER BY recorded_at DESC').bind(scope),
 ]); return {birds:result[0].results,pairs:result[1].results,clutches:result[2].results,eggs:result[3].results,mutations:result[4].results} as unknown as Snapshot;
}
