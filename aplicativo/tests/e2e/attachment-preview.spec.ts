import { test, expect, type Page } from '@playwright/test';
import { emptyState } from '../../src/domain/types';
import { breedingHandler } from '../../src/domain/breeding';
import { documentsHandler, sha256 } from '../../src/domain/documents';
import { encryptObject } from '../../src/lib/storage';
import { navigateVisual } from './visual-helpers';

const password='previas-ficticias-para-teste';
const photo=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1kAAAAASUVORK5CYII=','base64');

/** Seed only this test context, preserving the production encrypted-vault format. */
async function seedPhotos(page:Page,count=30,tampered=false){
  const state=emptyState();
  state.settings.lastBackupAt=new Date().toISOString();
  for(let index=0;index<count;index++){
    const created=breedingHandler(state,'real','saveBird',{identification:`PREVIA-${String(index).padStart(2,'0')}`,name:`Ave ${index}`,species:'Calopsita',sex:'indeterminado',mutation:'Não informada',certainty:'observada',origin:'Cadastro',birthDate:'',status:'manejo'});
    const bird=state.birds.find(value=>value.id===created?.id)!;
    const added=documentsHandler(state,'real','attachment.add',{birdId:bird.id,contactId:null,saleId:null,title:`Foto ${index}`,category:'Foto da ave',date:'2026-10-13',issuer:'',reference:'',validUntil:'',notes:'',shareWithCustomer:false,previousId:null,fileName:'foto.png',mime:'image/png',size:photo.length,base64:photo.toString('base64'),sha256:sha256(photo)});
    bird.photoId=added!.id!;
    if(tampered)state.attachments.at(-1)!.sha256='0'.repeat(64);
  }
  const record={key:'vault',revision:0,envelope:await encryptObject(state,password),metadata:await encryptObject({sync:null,queue:[]},password)};
  await page.goto('/');
  await page.evaluate(async record=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('recanto-das-asas-private',2);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('vault'))request.result.createObjectStore('vault',{keyPath:'key'});if(!request.result.objectStoreNames.contains('backups'))request.result.createObjectStore('backups',{keyPath:'at'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('vault','readwrite');tx.objectStore('vault').put(record);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}finally{db.close();}
  },record);
  await page.reload();
  await page.getByLabel('Senha da base',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Desbloquear',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Hoje no criatório',exact:true})).toBeVisible();
  await navigateVisual(page,'Aves');
  return record.envelope.ciphertext;
}

test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});

test('bird thumbnails prepare near the viewport, share verified work and release URLs without altering stored photos',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    const audit=window as unknown as {previewUrls:Set<string>;previewWorkers:number};audit.previewUrls=new Set();audit.previewWorkers=0;
    const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),OriginalWorker=window.Worker;
    URL.createObjectURL=blob=>{const url=create(blob);audit.previewUrls.add(url);return url;};
    URL.revokeObjectURL=url=>{audit.previewUrls.delete(url);revoke(url);};
    window.Worker=class extends OriginalWorker{constructor(url:string|URL,options?:WorkerOptions){super(url,options);if(String(url).includes('attachment-preview'))audit.previewWorkers++;}};
  });
  const ciphertext=await seedPhotos(page);
  const list=page.getByRole('list',{name:'Lista de aves',exact:true}),rows=list.locator('.bird-list-row');
  await expect(rows).toHaveCount(30);
  await expect(rows.first().getByRole('img')).toBeVisible();
  await expect(rows.last().getByRole('img')).toHaveCount(0);
  expect(await page.evaluate(()=>(window as unknown as {previewWorkers:number}).previewWorkers)).toBeLessThanOrEqual(2);
  await rows.last().scrollIntoViewIfNeeded();
  await expect(rows.last().getByRole('img')).toBeVisible();
  await expect(rows.first().getByRole('img')).toHaveCount(0);
  await page.getByLabel('Buscar aves',{exact:true}).fill('Nenhuma ave corresponde');
  await expect(rows).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {previewUrls:Set<string>}).previewUrls.size)).toBe(0);
  const persisted=await page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('recanto-das-asas-private',2);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    try{return await new Promise<string>((resolve,reject)=>{const request=db.transaction('vault','readonly').objectStore('vault').get('vault');request.onsuccess=()=>resolve(request.result.envelope.ciphertext);request.onerror=()=>reject(request.error);});}finally{db.close();}
  });
  expect(persisted).toBe(ciphertext);expect(errors).toEqual([]);
});

test('a corrupted photo never receives a preview URL and shows the integrity error',async({page})=>{
  await seedPhotos(page,1,true);
  await expect(page.getByRole('alert').filter({hasText:'O arquivo não passou na verificação de integridade.'})).toBeVisible();
  await expect(page.locator('.attachment-thumbnail-frame img')).toHaveCount(0);
});

test('a reader that blocks preview workers still verifies and displays photos through the cooperative fallback',async({page})=>{
  await page.addInitScript(()=>{
    const OriginalWorker=window.Worker;
    window.Worker=class extends OriginalWorker{constructor(url:string|URL,options?:WorkerOptions){if(String(url).includes('attachment-preview'))throw new DOMException('Worker indisponível.','SecurityError');super(url,options);}};
  });
  await seedPhotos(page,1);
  await expect(page.locator('.attachment-thumbnail-frame img').first()).toBeVisible();
  await expect(page.getByRole('alert').filter({hasText:/integridade|prévia/})).toHaveCount(0);
});
