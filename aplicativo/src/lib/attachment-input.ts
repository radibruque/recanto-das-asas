import type { Attachment } from '../domain/types';
import { base64ToBytes, bytesToBase64, MAX_ATTACHMENT_BYTES, sha256, verifyFile } from '../domain/documents';
import { today } from '../domain/shared';
import { imageDimensions } from './attachment-image-dimensions';
export { imageDimensions } from './attachment-image-dimensions';

/** Prepared once when a user selects a file; commands add the links atomically. */
export type PendingAttachment = Omit<Attachment, 'id'|'scope'|'version'|'birdId'|'contactId'|'saleId'|'previousId'> & {
  role?: 'photo';
  sourceType?: string;
  sourceId?: string|null;
};
export const MAX_PENDING_ATTACHMENTS = 12;
export const MAX_PENDING_BYTES = 30 * 1024 * 1024;
const mimeByExtension:Record<string,string> = {
  pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',txt:'text/plain',
};

export type SelectedFile = Pick<File, 'name'|'size'|'arrayBuffer'>;

export async function prepareAttachment(file:SelectedFile, category='Documento', role?:'photo'):Promise<PendingAttachment> {
  if (!file.size || file.size > MAX_ATTACHMENT_BYTES) throw new Error('Cada arquivo deve ter entre 1 byte e 10 MB.');
  if(file.name.length>150)throw new Error('O nome do arquivo deve ter até 150 caracteres. Renomeie-o antes de anexar.');
  const extension=file.name.split('.').pop()?.toLowerCase() || '';
  const mime=mimeByExtension[extension];
  if (!mime) throw new Error('Formato não permitido. Escolha PDF, PNG, JPG ou TXT UTF-8.');
  if (role==='photo' && !mime.startsWith('image/')) throw new Error('A foto principal precisa ser PNG ou JPG.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== file.size) throw new Error('Não foi possível ler o arquivo completo. Selecione-o novamente.');
  verifyFile(bytes,mime,file.name);
  return {
    title:file.name.replace(/\.[^.]+$/,'').slice(0,150) || 'Arquivo',category:category.slice(0,150) || 'Documento',
    date:today(),issuer:'',reference:'',validUntil:'',notes:'',shareWithCustomer:false,
    fileName:file.name,mime,size:bytes.length,base64:bytesToBase64(bytes),sha256:sha256(bytes),
    ...(role ? {role} : {}),
  };
}

/** Read sequentially, and return all or nothing so a bad file never disappears silently. */
export async function prepareAttachmentSelection(files:readonly SelectedFile[], existing:readonly PendingAttachment[]=[], category='Documento', photo=false):Promise<PendingAttachment[]> {
  if (existing.length + files.length > MAX_PENDING_ATTACHMENTS) throw new Error(`Anexe no máximo ${MAX_PENDING_ATTACHMENTS} arquivos neste registro.`);
  if (existing.reduce((sum,file)=>sum+file.size,0)+files.reduce((sum,file)=>sum+file.size,0)>MAX_PENDING_BYTES) throw new Error('Os arquivos deste registro somam mais de 30 MB. Selecione arquivos menores.');
  const prepared:PendingAttachment[]=[];
  for (const file of files) prepared.push(await prepareAttachment(file,category,photo?'photo':undefined));
  const result=[...existing,...prepared];
  // Selecting a new principal photo preserves the older image as an ordinary attachment.
  if (photo && prepared.length) {
    const selectedIndex=result.length-1;
    return result.map((file,index)=>index===selectedIndex ? {...file,role:'photo'} : omitPhotoRole(file));
  }
  return result;
}

export function omitPhotoRole(file:PendingAttachment):PendingAttachment {
  const {role: _role,...rest}=file;
  return rest;
}

/** Keep the original in the archive and use a bounded image for cards and PDFs. */
export async function preparePrincipalPhoto(file:SelectedFile,category='Foto da ave'):Promise<PendingAttachment[]> {
  const original=await prepareAttachment(file,category,'photo');
  const bytes=base64ToBytes(original.base64),dimensions=imageDimensions(bytes,original.mime);
  if (!dimensions || !dimensions.width || !dimensions.height) throw new Error('Não foi possível reconhecer as dimensões da foto. Escolha outra imagem PNG ou JPG.');
  if (dimensions.width>20000 || dimensions.height>20000 || dimensions.width*dimensions.height>64_000_000) throw new Error('A foto tem resolução muito alta. Envie uma cópia com até 64 megapixels.');
  if (Math.max(dimensions.width,dimensions.height)<=1600 && original.size<=1024*1024) return [original];
  const factor=Math.min(1,1600/Math.max(dimensions.width,dimensions.height));
  const width=Math.max(1,Math.round(dimensions.width*factor)),height=Math.max(1,Math.round(dimensions.height*factor));
  const blob=new Blob([new Uint8Array(bytes)],{type:original.mime});
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a foto neste aparelho.');
  context.fillStyle='#ffffff';context.fillRect(0,0,width,height);
  if (typeof createImageBitmap==='function') {
    const bitmap=await createImageBitmap(blob,{resizeWidth:width,resizeHeight:height,resizeQuality:'high'});
    try {context.drawImage(bitmap,0,0,width,height);} finally {bitmap.close();}
  } else {
    if (dimensions.width*dimensions.height>20_000_000) throw new Error('Neste aparelho, escolha uma foto com até 20 megapixels para preparar a caderneta.');
    const url=URL.createObjectURL(blob);
    try {
      const image=new Image();image.src=url;
      await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('A foto não pôde ser aberta.'));});
      context.drawImage(image,0,0,width,height);
    } finally {URL.revokeObjectURL(url);}
  }
  const reduced=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Não foi possível preparar a foto.')),'image/jpeg',0.86));
  // Reset the canvas promptly on devices with limited graphic memory.
  canvas.width=1;canvas.height=1;
  const fileName=original.fileName.replace(/\.[^.]+$/,'').slice(0,130)+'_foto.jpg';
  const photo=await prepareAttachment({name:fileName,size:reduced.size,arrayBuffer:()=>reduced.arrayBuffer()},category,'photo');
  photo.title=original.title.slice(0,130)+' (foto preparada)';photo.notes='Cópia preparada para a ficha e a caderneta. O arquivo original está preservado neste mesmo registro.';
  const preserved=omitPhotoRole(original);preserved.notes='Foto original preservada. A cópia preparada é usada na ficha e na caderneta.';
  return [preserved,photo];
}
