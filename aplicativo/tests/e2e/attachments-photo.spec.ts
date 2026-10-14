import { test, expect } from '@playwright/test';
import { revealFormField } from './visual-helpers';
import type { State } from '../../src/domain/types';

test('large principal photo keeps the original and uses a bounded image for the bird and PDF',async({page})=>{
  const password='foto-grande-base-ficticia';
  await page.goto('/');
  await page.getByLabel('Senha da base',{exact:true}).fill(password);
  await page.getByLabel('Confirmar senha',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Criar base privada',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Hoje no criatório',exact:true})).toBeVisible();
  const photoBase64=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=1200;
    const context=canvas.getContext('2d')!;const gradient=context.createLinearGradient(0,0,2400,1200);gradient.addColorStop(0,'#054973');gradient.addColorStop(1,'#67994b');context.fillStyle=gradient;context.fillRect(0,0,2400,1200);
    const blob=await new Promise<Blob>(resolve=>canvas.toBlob(blob=>resolve(blob!),'image/jpeg',0.95));
    const bytes=new Uint8Array(await blob.arrayBuffer());let result='';for(let offset=0;offset<bytes.length;offset+=32768)result+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
    return btoa(result);
  });
  await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Aves',exact:true}).click();
  await page.getByRole('button',{name:'Cadastrar ave',exact:true}).click();
  const form=page.getByRole('dialog');
  await form.getByLabel('Identificação ou anilha *',{exact:true}).fill('FOTO-GRANDE');
  await form.getByLabel('Nome',{exact:true}).fill('Foto de teste');
  await form.getByLabel('Espécie *',{exact:true}).fill('Calopsita');
  await (await revealFormField(form, 'Foto principal da ave')).setInputFiles({name:'foto-original.jpg',mimeType:'image/jpeg',buffer:Buffer.from(photoBase64,'base64')});
  await expect(form.getByText('foto-original_foto.jpg',{exact:true})).toBeVisible();
  await expect(form.getByText('foto-original.jpg',{exact:true})).toBeVisible();
  await expect(form.getByRole('button',{name:'Salvar',exact:true})).toBeEnabled();
  await form.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(form).not.toBeVisible();
  const state=await page.evaluate(async password=>{
    const database=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('recanto-das-asas-private',2);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    try{
      const record=await new Promise<any>((resolve,reject)=>{const request=database.transaction('vault','readonly').objectStore('vault').get('vault');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      const bytes=(value:string)=>Uint8Array.from(atob(value),character=>character.charCodeAt(0)),envelope=record.envelope;
      const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
      const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(envelope.salt),iterations:envelope.iterations,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt']);
      const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv)},key,bytes(envelope.ciphertext));return JSON.parse(new TextDecoder().decode(plain));
    }finally{database.close();}
  },password) as State;
  expect(state.birds).toHaveLength(1);expect(state.attachments).toHaveLength(2);
  expect(state.attachments.find(attachment=>attachment.fileName==='foto-original.jpg')?.base64).toBe(photoBase64);
  const principal=state.attachments.find(attachment=>attachment.id===state.birds[0].photoId)!;
  expect(principal.fileName).toBe('foto-original_foto.jpg');expect(principal.mime).toBe('image/jpeg');
  const dimensions=await page.evaluate(async photo=>{
    const image=new Image();image.src=`data:image/jpeg;base64,${photo}`;await image.decode();return{width:image.naturalWidth,height:image.naturalHeight};
  },principal.base64);
  expect(dimensions).toEqual({width:1600,height:800});
  await page.getByRole('button',{name:'Foto de teste · FOTO-GRANDE',exact:true}).click();
  const preview=page.getByRole('img',{name:principal.title,exact:true}).first();
  await expect(preview).toBeVisible();
  const previewDimensions=await preview.evaluate(element=>({width:(element as HTMLImageElement).naturalWidth,height:(element as HTMLImageElement).naturalHeight}));
  expect(previewDimensions).toEqual({width:1200,height:600});
});
