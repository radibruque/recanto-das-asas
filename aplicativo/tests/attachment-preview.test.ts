import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { base64ToBytes, MAX_ATTACHMENT_BYTES } from '../src/domain/documents';
import { acquireAttachmentPreview } from '../src/lib/attachment-preview';
import { decodePreviewBase64, decodeVerifiedPreview, previewSha256, type PreviewPayload } from '../src/lib/attachment-preview-data';

const originalDecoder=(value:string)=>{
  if(value.length>Math.ceil(MAX_ATTACHMENT_BYTES/3)*4)throw new Error('O arquivo excede 10 MB.');
  if(!(value.length>0&&value.length%4===0&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)))throw new Error('Conteúdo do arquivo inválido.');
  return Uint8Array.from(atob(value),character=>character.charCodeAt(0));
};
const result=(decoder:(value:string)=>Uint8Array,value:string)=>{try{return [...decoder(value)];}catch(error){return error instanceof Error?error.message:String(error);}};
const payload=(bytes:Uint8Array=new TextEncoder().encode('Arquivo de teste.')):PreviewPayload=>({mime:'text/plain',base64:Buffer.from(bytes).toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});

describe('Base64 shared attachment decoder',()=>{
  it('preserves the previous alphabet, padding, bytes and error messages on exhaustive short strings',()=>{
    const alphabet=['A','Z','a','9','+','/','=',' ','\n','é'];
    let samples=[''];
    for(let length=0;length<=4;length++){
      for(const value of samples)expect(result(base64ToBytes,value)).toEqual(result(originalDecoder,value));
      samples=samples.flatMap(value=>alphabet.map(character=>value+character));
    }
    for(const value of ['AB==','AZ==','A/==','AAB=','AA/=','AAAA','A===','AA==AAAA','AAAA\n','\tAAAA','A_AA','A-AA'])expect(result(base64ToBytes,value)).toEqual(result(originalDecoder,value));
  });
  it('recovers exact bytes at 4 and 10 MiB without the repeated regex stack overflow',()=>{
    for(const length of [4*1024*1024,MAX_ATTACHMENT_BYTES]){
      const bytes=Buffer.alloc(length);for(let index=0;index<length;index++)bytes[index]=(index*37+11)%256;
      expect(Buffer.from(base64ToBytes(bytes.toString('base64'))).equals(bytes)).toBe(true);
    }
    expect(()=>base64ToBytes('A'.repeat(Math.ceil(MAX_ATTACHMENT_BYTES/3)*4+4))).toThrow('O arquivo excede 10 MB.');
  });
});

describe('Asynchronous, verified preview data',()=>{
  it('uses bounded turns and preserves bytes and noncanonical padding at chunk boundaries',async()=>{
    const bytes=Buffer.alloc(65536);for(let index=0;index<bytes.length;index++)bytes[index]=index%256;
    let inputHandled=false;setTimeout(()=>{inputHandled=true;},0);
    expect(Buffer.from(await decodePreviewBase64(bytes.toString('base64'))).equals(bytes)).toBe(true);
    expect(inputHandled).toBe(true);
    for(const value of ['AB==','AA/=','A'.repeat(65536)+'AB=='])expect(await decodePreviewBase64(value)).toEqual(base64ToBytes(value));
    for(const value of ['', 'AAA', 'AA==AAAA', 'A'.repeat(65534)+'==AAAA', 'A'.repeat(65536)+'AA?='])await expect(decodePreviewBase64(value)).rejects.toThrow('Conteúdo do arquivo inválido.');
    await expect(decodePreviewBase64('A'.repeat(Math.ceil(MAX_ATTACHMENT_BYTES/3)*4+4))).rejects.toThrow('O arquivo excede 10 MB.');
  });
  it('matches standard SHA-256 through native and cooperative fallback paths',async()=>{
    for(const length of [0,1,55,56,63,64,65,65536]){
      const bytes=Buffer.alloc(length);for(let index=0;index<length;index++)bytes[index]=(index*37+11)%256;
      expect(await previewSha256(bytes)).toBe(createHash('sha256').update(bytes).digest('hex'));
    }
    vi.stubGlobal('crypto',undefined);
    for(const length of [0,1,55,56,63,64,65,65536]){
      const bytes=Buffer.alloc(length);for(let index=0;index<length;index++)bytes[index]=(index*37+11)%256;
      expect(await previewSha256(bytes)).toBe(createHash('sha256').update(bytes).digest('hex'));
    }
  });
  it('verifies integrity before returning bytes and honors cancellation between chunks',async()=>{
    const data=payload();expect((await decodeVerifiedPreview(data)).bytes).toEqual(base64ToBytes(data.base64));
    await expect(decodeVerifiedPreview({...data,sha256:'0'.repeat(64)})).rejects.toThrow('O arquivo não passou na verificação de integridade.');
    const controller=new AbortController(),work=decodePreviewBase64(Buffer.alloc(256*1024).toString('base64'),controller.signal);
    controller.abort();await expect(work).rejects.toMatchObject({name:'AbortError'});
  });
});

describe('Mounted preview leases',()=>{
  it('uses a verified fallback when a worker constructor fails with TypeError',async()=>{
    vi.stubGlobal('Worker',class{constructor(){throw new TypeError('Workers não suportados neste leitor.');}});
    const data=payload(),lease=acquireAttachmentPreview(data);
    try{expect(new Uint8Array(await (await lease.blob).arrayBuffer())).toEqual(base64ToBytes(data.base64));}finally{lease.release();}
    const corrupted=acquireAttachmentPreview({...data,sha256:'0'.repeat(64)});
    try{await expect(corrupted.blob).rejects.toThrow('O arquivo não passou na verificação de integridade.');}finally{corrupted.release();}
  });
  it('times out a stalled worker, terminates it and sends only bytes, MIME and hash before verified fallback',async()=>{
    vi.useFakeTimers();
    vi.stubGlobal('crypto',undefined);
    const sent=vi.fn(),terminated=vi.fn();
    vi.stubGlobal('Worker',class{onmessage=null;onerror=null;onmessageerror=null;postMessage=sent;terminate=terminated;});
    const data={...payload(),title:'Título privado',notes:'Observações privadas',birdId:'Identificação privada'},lease=acquireAttachmentPreview(data);
    try{
      await vi.advanceTimersByTimeAsync(29_999);
      expect(sent).toHaveBeenCalledOnce();expect(sent.mock.calls[0][0]).toEqual({base64:data.base64,mime:data.mime,sha256:data.sha256});expect(terminated).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);expect(terminated).toHaveBeenCalledOnce();
      await vi.runAllTimersAsync();
      expect(new Uint8Array(await (await lease.blob).arrayBuffer())).toEqual(base64ToBytes(data.base64));
    }finally{lease.release();vi.useRealTimers();}
  });
  it('aborts a stalled worker immediately without starting fallback and clears its timeout',async()=>{
    vi.useFakeTimers();
    const sent=vi.fn(),terminated=vi.fn();
    vi.stubGlobal('Worker',class{onmessage=null;onerror=null;onmessageerror=null;postMessage=sent;terminate=terminated;});
    const lease=acquireAttachmentPreview(payload()),result=expect(lease.blob).rejects.toMatchObject({name:'AbortError'});
    try{await vi.advanceTimersByTimeAsync(0);expect(sent).toHaveBeenCalledOnce();lease.release();await result;
      expect(terminated).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
    }finally{lease.release();await result;}
  });
  it('shares work for identical bytes only and disposes it after the last view releases',async()=>{
    const data=payload(),one=acquireAttachmentPreview(data),two=acquireAttachmentPreview({...data});
    try{
      expect(one.blob).toBe(two.blob);one.release();one.release();
      expect(new Uint8Array(await (await two.blob).arrayBuffer())).toEqual(base64ToBytes(data.base64));
      const tampered=acquireAttachmentPreview({...data,base64:payload(new TextEncoder().encode('Arquivo alterado')).base64});
      try{expect(tampered.blob).not.toBe(two.blob);await expect(tampered.blob).rejects.toThrow(/integridade/);}finally{tampered.release();}
    }finally{one.release();two.release();}
    const next=acquireAttachmentPreview(data);
    try{expect(next.blob).not.toBe(two.blob);await next.blob;}finally{next.release();}
  });
  it('cancels running and queued work without poisoning later previews',async()=>{
    const leases=[0,1,2].map(index=>acquireAttachmentPreview(payload(new Uint8Array(256*1024).fill(index))));
    const results=leases.map(lease=>expect(lease.blob).rejects.toMatchObject({name:'AbortError'}));
    leases.forEach(lease=>lease.release());await Promise.all(results);
    const next=acquireAttachmentPreview(payload());try{await expect(next.blob).resolves.toBeInstanceOf(Blob);}finally{next.release();}
  });
  it('enforces the existing image dimension guards before decoding a picture',async()=>{
    const png=new Uint8Array(24),view=new DataView(png.buffer);view.setUint32(16,9000);view.setUint32(20,8000);
    const image=acquireAttachmentPreview({...payload(png),mime:'image/png'});
    try{await expect(image.blob).rejects.toThrow('Esta foto é grande demais para a prévia. Use Baixar original para recuperar o arquivo.');}finally{image.release();}
    const unrecognized=acquireAttachmentPreview({...payload(),mime:'image/jpeg'});
    try{await expect(unrecognized.blob).rejects.toThrow('Não foi possível criar a prévia desta foto. Use Baixar original para recuperar o arquivo.');}finally{unrecognized.release();}
  });
});
