import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import type { Attachment } from '../domain/types';
import { base64ToBytes, sha256 } from '../domain/documents';
import { dateLabel } from '../domain/shared';
import { downloadBytes } from '../lib/exports';
import { imageDimensions, MAX_PENDING_ATTACHMENTS, MAX_PENDING_BYTES, omitPhotoRole, prepareAttachmentSelection, preparePrincipalPhoto, type PendingAttachment } from '../lib/attachment-input';

export type { PendingAttachment } from '../lib/attachment-input';
const errorMessage=(error:unknown)=>error instanceof Error ? error.message : 'Não foi possível abrir o arquivo.';
const sizeLabel=(size:number)=>size>=1024*1024 ? `${(size/1024/1024).toFixed(1)} MB` : `${(size/1024).toFixed(1)} KB`;

function useAttachmentUrl(attachment:{base64:string;mime:string;sha256:string}|null) {
  const [url,setUrl]=useState(''),[error,setError]=useState('');
  useEffect(()=>{
    setUrl('');setError('');
    if (!attachment) return;
    let objectUrl='',active=true;
    void(async()=>{
      try {
        const bytes=base64ToBytes(attachment.base64);
        if (sha256(bytes)!==attachment.sha256) throw new Error('O arquivo não passou na verificação de integridade.');
        let blob=new Blob([new Uint8Array(bytes)],{type:attachment.mime});
        if(attachment.mime.startsWith('image/')){
          const dimensions=imageDimensions(bytes,attachment.mime);
          if(!dimensions||!dimensions.width||!dimensions.height)throw new Error('Não foi possível criar a prévia desta foto. Use Baixar original para recuperar o arquivo.');
          if(dimensions.width*dimensions.height>64_000_000||dimensions.width>20000||dimensions.height>20000)throw new Error('Esta foto é grande demais para a prévia. Use Baixar original para recuperar o arquivo.');
          if(Math.max(dimensions.width,dimensions.height)>1200){
            if(typeof createImageBitmap!=='function')throw new Error('Use Visualizar para abrir esta foto no leitor do aparelho.');
            const factor=1200/Math.max(dimensions.width,dimensions.height),width=Math.max(1,Math.round(dimensions.width*factor)),height=Math.max(1,Math.round(dimensions.height*factor));
            const bitmap=await createImageBitmap(blob,{resizeWidth:width,resizeHeight:height,resizeQuality:'high'});
            try{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');if(!context)throw new Error('Não foi possível preparar a prévia.');context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(bitmap,0,0,width,height);blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Não foi possível preparar a prévia.')),'image/jpeg',0.8));canvas.width=1;canvas.height=1;}finally{bitmap.close();}
          }
        }
        if(!active)return;
        objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);
      }catch(error){if(active)setError(errorMessage(error));}
    })();
    return ()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[attachment?.base64,attachment?.mime,attachment?.sha256]);
  return {url,error};
}

export function AttachmentThumbnail({attachment,maxHeight=180}:{attachment:Pick<Attachment,'base64'|'mime'|'sha256'|'title'>;maxHeight?:number}) {
  const {url,error}=useAttachmentUrl(attachment.mime.startsWith('image/')?attachment:null);
  return error ? <p role="alert">{error}</p> : url ? <img src={url} alt={attachment.title} loading="lazy" style={{display:'block',maxWidth:'100%',maxHeight,objectFit:'contain',borderRadius:8,margin:'8px 0'}}/> : null;
}

type PickerProps={
  value:PendingAttachment[];
  onChange:(attachments:PendingAttachment[])=>void;
  category?:string;
  allowPhoto?:boolean;
  disabled?:boolean;
  onBusyChange?:(busy:boolean)=>void;
};

export function AttachmentPicker({value,onChange,category='Documento',allowPhoto=false,disabled=false,onBusyChange}:PickerProps) {
  const input=useRef<HTMLInputElement>(null),photoInput=useRef<HTMLInputElement>(null);
  const current=useRef(value);current.current=value;
  const mounted=useRef(true);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  async function select(files:File[],photo=false) {
    if (!files.length || busy || disabled) return;
    setBusy(true);setError('');onBusyChange?.(true);
    try {
      if (allowPhoto && photo) {
        const prepared=await preparePrincipalPhoto(files[0],category);
        const existing=current.current.map(omitPhotoRole);
        if (existing.length+prepared.length>MAX_PENDING_ATTACHMENTS) throw new Error(`Anexe no máximo ${MAX_PENDING_ATTACHMENTS} arquivos neste registro.`);
        if ([...existing,...prepared].reduce((total,file)=>total+file.size,0)>MAX_PENDING_BYTES) throw new Error('Os arquivos deste registro somam mais de 30 MB. Selecione arquivos menores.');
        if(mounted.current)onChange([...existing,...prepared]);
      } else {
        const prepared=await prepareAttachmentSelection(files,current.current,category);
        if(mounted.current)onChange(prepared);
      }
    } catch (error) {if(mounted.current)setError(errorMessage(error));}
    finally {if(mounted.current)setBusy(false);onBusyChange?.(false);}
  }
  function change(index:number,patch:Partial<PendingAttachment>) {onChange(value.map((file,i)=>i===index?{...file,...patch}:file));}
  async function selectPrincipal(index:number){
    if(busy||disabled)return;
    const selected=current.current[index];if(!selected)return;
    setBusy(true);setError('');onBusyChange?.(true);
    try{
      const bytes=base64ToBytes(selected.base64);
      const prepared=await preparePrincipalPhoto({name:selected.fileName,size:selected.size,arrayBuffer:async()=>new Uint8Array(bytes).buffer},selected.category);
      const principal=prepared.at(-1)!;
      const existing=current.current.map(omitPhotoRole);
      const matching=existing.findIndex(file=>file.sha256===principal.sha256);
      const next=matching>=0 ? existing.map((file,i)=>i===matching?{...file,role:'photo' as const}:file) : [...existing,principal];
      if(next.length>MAX_PENDING_ATTACHMENTS||next.reduce((sum,file)=>sum+file.size,0)>MAX_PENDING_BYTES)throw new Error('A foto preparada excede o limite de anexos deste registro. Remova outros arquivos ou escolha uma foto menor.');
      if(mounted.current)onChange(next);
    }catch(error){if(mounted.current)setError(errorMessage(error));}
    finally{if(mounted.current)setBusy(false);onBusyChange?.(false);}
  }
  return <fieldset className="direct-attachments">
    <legend>Arquivos deste registro</legend>
    <p className="muted">Anexe documentos e fotos aqui. Eles serão guardados junto com o registro e aparecerão no acervo. PDF, PNG, JPG e TXT UTF-8; até 10 MB por arquivo.</p>
    <div className="toolbar">
      <button type="button" className="button secondary" disabled={busy||disabled} onClick={()=>input.current?.click()}>Anexar arquivos</button>
      <button type="button" className="button secondary" disabled={busy||disabled} onClick={()=>photoInput.current?.click()}>{allowPhoto?'Escolher foto principal':'Anexar foto'}</button>
    </div>
    <input ref={input} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt" aria-label="Arquivos para anexar" style={{display:'none'}} disabled={busy||disabled} onChange={event=>{const files=Array.from(event.target.files||[]);event.target.value='';void select(files);}}/>
    <input ref={photoInput} type="file" accept="image/png,image/jpeg" aria-label={allowPhoto?'Foto principal da ave':'Foto para anexar'} style={{display:'none'}} disabled={busy||disabled} onChange={event=>{const files=Array.from(event.target.files||[]);event.target.value='';void select(files,true);}}/>
    {busy&&<p role="status">Preparando arquivos… aguarde antes de salvar.</p>}
    {error&&<p role="alert" className="error">{error}</p>}
    {value.map((file,index)=><article className="card" key={`${file.sha256}-${index}`} style={{margin:'12px 0',padding:16}}>
      <div className="row"><strong>{file.fileName}</strong><span className="muted">{sizeLabel(file.size)}{file.role==='photo'?' · Foto principal':''}</span></div>
      {file.mime.startsWith('image/')&&<AttachmentThumbnail attachment={file} maxHeight={140}/>}
      <div className="form-grid"><label>Título do arquivo<input maxLength={150} required value={file.title} disabled={busy||disabled} onChange={event=>change(index,{title:event.target.value})}/></label><label>Categoria do arquivo<input maxLength={150} required value={file.category} disabled={busy||disabled} onChange={event=>change(index,{category:event.target.value})}/></label></div>
      <label>Observações do arquivo<textarea maxLength={2000} rows={2} value={file.notes} disabled={busy||disabled} onChange={event=>change(index,{notes:event.target.value})}/></label>
      <details><summary>Data e informações do documento</summary><div className="form-grid"><label>Data do arquivo<input type="date" required value={file.date} disabled={busy||disabled} onChange={event=>change(index,{date:event.target.value})}/></label><label>Validade opcional<input type="date" value={file.validUntil} disabled={busy||disabled} onChange={event=>change(index,{validUntil:event.target.value})}/></label><label>Emissor<input maxLength={2000} value={file.issuer} disabled={busy||disabled} onChange={event=>change(index,{issuer:event.target.value})}/></label><label>Referência<input maxLength={2000} value={file.reference} disabled={busy||disabled} onChange={event=>change(index,{reference:event.target.value})}/></label></div><label className="check"><input type="checkbox" checked={file.shareWithCustomer} disabled={busy||disabled} onChange={event=>change(index,{shareWithCustomer:event.target.checked})}/>Pode ser incluído na entrega ao cliente</label></details>
      <div className="toolbar">{allowPhoto&&file.mime.startsWith('image/')&&<button type="button" className="button secondary" disabled={busy||disabled} onClick={()=>void selectPrincipal(index)}>Usar como foto principal</button>}<button type="button" className="button secondary" disabled={busy||disabled} onClick={()=>onChange(value.filter((_,i)=>i!==index))}>Remover deste registro</button></div>
    </article>)}
    {!value.length&&<p className="muted">Nenhum arquivo selecionado.</p>}
  </fieldset>;
}

export function AttachmentPreview({attachment}:{attachment:Attachment}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[expanded,setExpanded]=useState(false),[text,setText]=useState('');
  const {url,error:urlError}=useAttachmentUrl(attachment);
  useEffect(()=>{setExpanded(false);setError('');setText('');if(attachment.mime==='text/plain'){try{setText(new TextDecoder('utf-8',{fatal:true}).decode(base64ToBytes(attachment.base64)));}catch(error){setError(errorMessage(error));}}},[attachment.id,attachment.base64,attachment.mime]);
  async function operate(view=false) {
    setBusy(true);setError('');
    try {
      const bytes=base64ToBytes(attachment.base64);
      if(sha256(bytes)!==attachment.sha256)throw new Error('O arquivo não passou na verificação de integridade.');
      if(view){setExpanded(true);const {viewFileBytes}=await import('../lib/exports');await viewFileBytes(bytes,attachment.fileName,attachment.mime);}else await downloadBytes(bytes,attachment.fileName,attachment.mime);
    } catch(error) {setError(errorMessage(error));} finally {setBusy(false);}
  }
  return <div className="attachment-preview">
    <p><strong>{attachment.title}</strong><small>{attachment.fileName} · {sizeLabel(attachment.size)} · {dateLabel(attachment.date)}</small></p>
    {attachment.mime.startsWith('image/')&&url&&<img src={url} alt={attachment.title} style={{display:'block',width:'100%',maxHeight:expanded?640:220,objectFit:'contain',background:'#eef4f7',borderRadius:8}}/>}
    {attachment.mime==='text/plain'&&<pre style={{maxHeight:expanded?500:160,overflow:'auto',padding:12,background:'#eef4f7'}}>{text}</pre>}
    {attachment.mime==='application/pdf'&&<><p className="muted">PDF · {sizeLabel(attachment.size)}. Use Visualizar para abrir o documento completo no leitor.</p>{url&&!Capacitor.isNativePlatform()&&<iframe src={url} title={`Prévia de ${attachment.title}`} style={{height:300,minHeight:220,maxHeight:300}}/>}</>}
    {(error||urlError)&&<p role="alert" className="error">{error||urlError}</p>}
    <div className="toolbar"><button type="button" className="button secondary" disabled={busy} onClick={()=>void operate(true)}>Visualizar</button><button type="button" className="button secondary" disabled={busy} onClick={()=>void operate()}>Baixar original</button></div>
  </div>;
}
