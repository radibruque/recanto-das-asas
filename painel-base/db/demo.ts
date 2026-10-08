import { database } from './store';
import { speciesOptions } from '../lib/model';
export async function initializeDemo() {
 const db=database(); if(await db.prepare('SELECT id FROM demo_init WHERE id=1').first()) return;
 const rows=[
 ['demo-azul','EX-001','Azul',speciesOptions[1],'macho','Azul','2025-04-12',null,null],
 ['demo-lua','EX-002','Lua',speciesOptions[1],'fêmea','Verde','2025-06-08',null,null],
 ['demo-pingo','EX-003','Pingo',speciesOptions[0],'macho','Cinza','2025-01-20',null,null],
 ['demo-pipoca','EX-004','Pipoca',speciesOptions[0],'fêmea','Lutino','2025-02-10',null,null],
 ['demo-nuvem','EX-005','Nuvem',speciesOptions[1],'indeterminado','A definir','2026-09-28','demo-azul','demo-lua'],
 ['demo-gota','EX-006','Gota',speciesOptions[1],'indeterminado','A definir','2026-09-30','demo-azul','demo-lua'],
 ];
 const statements=rows.map(r=>db.prepare("INSERT OR IGNORE INTO birds (id,scope,identification,name,species,sex,mutation,certainty,carriers,origin,notes,birth_date,father_id,mother_id,created_at) VALUES (?,'demo',?,?,?,?,?,'observada','',?,'Registro fictício para demonstração.',?,?,?,?)").bind(r[0],r[1],r[2],r[3],r[4],r[5],r[7]?'Nascimento fictício no criatório':'Origem fictícia',r[6],r[7],r[8],'2026-10-01T12:00:00Z'));
 statements.push(db.prepare("INSERT OR IGNORE INTO pairs VALUES ('demo-pair1','demo','Azul & Lua','demo-azul','demo-lua','2026-08-20',NULL,'Casal fictício.')"),db.prepare("INSERT OR IGNORE INTO pairs VALUES ('demo-pair2','demo','Pingo & Pipoca','demo-pingo','demo-pipoca','2026-09-01',NULL,'Casal fictício.')"));
 statements.push(db.prepare("INSERT OR IGNORE INTO clutches VALUES ('demo-clutch1','demo','demo-pair1','2026-09-08',NULL,'Postura fictícia.')"),db.prepare("INSERT OR IGNORE INTO clutches VALUES ('demo-clutch2','demo','demo-pair2','2026-09-22',NULL,'Postura fictícia.')"));
 const eggs=[['demo-e1','demo-clutch1',1,'2026-09-08','eclodido','2026-09-28','demo-nuvem'],['demo-e2','demo-clutch1',2,'2026-09-10','eclodido','2026-09-30','demo-gota'],['demo-e3','demo-clutch1',3,'2026-09-12','infértil',null,null],['demo-e4','demo-clutch2',1,'2026-09-22','incubando',null,null],['demo-e5','demo-clutch2',2,'2026-09-24','incubando',null,null],['demo-e6','demo-clutch2',3,'2026-09-26','incubando',null,null]];
 for(const r of eggs) statements.push(db.prepare("INSERT OR IGNORE INTO eggs VALUES (?,'demo',?,?,?,?,?,?,'Exemplo fictício.')").bind(...r));
 for(const r of rows) statements.push(db.prepare("INSERT OR IGNORE INTO mutation_history VALUES (?,'demo',?,?,'observada','','2026-10-01T12:00:00Z')").bind('mutation-'+r[0],r[0],r[5]));
 statements.push(db.prepare('INSERT OR IGNORE INTO demo_init VALUES (1)')); await db.batch(statements);
}
