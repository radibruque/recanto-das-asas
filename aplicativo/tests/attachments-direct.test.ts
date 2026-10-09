import { describe, expect, it, vi } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { emptyState, type Attachment, type Bird, type State } from '../src/domain/types';
import { attachmentBirdIds, bytesToBase64, documentsHandler, filterAttachments, groupAttachments, sha256 } from '../src/domain/documents';
import { breedingHandler } from '../src/domain/breeding';
import { imageDimensions, MAX_PENDING_BYTES, prepareAttachment, prepareAttachmentSelection, type SelectedFile } from '../src/lib/attachment-input';

const bytes=new TextEncoder().encode('Exame de João: acompanhamento em 10 dias.');
function file(name='exame.txt',content=bytes):SelectedFile{return{name,size:content.length,arrayBuffer:async()=>new Uint8Array(content).buffer};}
function bird(state:State,identification:string,scope:'real'|'demo'='real'):Bird{
  const result=breedingHandler(state,scope,'saveBird',{identification,name:identification==='01'?'João':'Lua',species:'Calopsita',sex:'indeterminado',mutation:'Não informada',certainty:'observada',origin:'Cadastro',birthDate:'',status:'manejo'});
  return state.birds.find(value=>value.id===result?.id)!;
}
function archive(state:State,extra:Record<string,unknown>={},scope:'real'|'demo'='real'):Attachment{
  const result=documentsHandler(state,scope,'attachment.add',{fileName:'exame.txt',mime:'text/plain',size:bytes.length,base64:bytesToBase64(bytes),sha256:sha256(bytes),birdId:null,contactId:null,saleId:null,title:'Exame',category:'Exame',date:'2026-10-01',issuer:'Clínica',reference:'A123',validUntil:'',notes:'',shareWithCustomer:false,previousId:null,...extra});
  return state.attachments.find(value=>value.id===result?.id)!;
}
describe('Anexos diretamente no registro',()=>{
  it('preserves original bytes and prepares a verifiable payload without orphan record IDs',async()=>{
    const prepared=await prepareAttachment(file(),'Saúde e manejo');
    expect(prepared).toMatchObject({category:'Saúde e manejo',title:'exame',fileName:'exame.txt',mime:'text/plain',size:bytes.length});
    expect(prepared.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(atob(prepared.base64)).toBe(String.fromCharCode(...bytes));
    expect(prepared).not.toHaveProperty('id');expect(prepared).not.toHaveProperty('birdId');
  });
  it('rejects oversized, unsupported and truncated files before storing any file',async()=>{
    const read=vi.fn(async()=>new Uint8Array(bytes).buffer);
    await expect(prepareAttachment({name:'exame.txt',size:10*1024*1024+1,arrayBuffer:read})).rejects.toThrow(/10 MB/);
    await expect(prepareAttachment({name:'run.exe',size:bytes.length,arrayBuffer:read})).rejects.toThrow(/Formato/);
    expect(read).not.toHaveBeenCalled();
    await expect(prepareAttachment({name:'exame.txt',size:bytes.length+1,arrayBuffer:read})).rejects.toThrow(/arquivo completo/);
    await expect(prepareAttachment(file(),'Foto','photo')).rejects.toThrow(/PNG ou JPG/);
  });
  it('keeps the previous selection intact if any newly chosen file is invalid',async()=>{
    const previous=[await prepareAttachment(file())],snapshot=structuredClone(previous);
    await expect(prepareAttachmentSelection([file('novo.txt'),file('falso.png')],previous)).rejects.toThrow(/PNG inválido/);
    expect(previous).toEqual(snapshot);
    const read=vi.fn(async()=>new Uint8Array(bytes).buffer);
    await expect(prepareAttachmentSelection([{name:'grande.txt',size:MAX_PENDING_BYTES+1,arrayBuffer:read}],previous)).rejects.toThrow(/30 MB/);
    expect(read).not.toHaveBeenCalled();
  });
  it('reads image dimensions before allocating a decoded picture',()=>{
    const png=new Uint8Array(24);new DataView(png.buffer).setUint32(16,8000);new DataView(png.buffer).setUint32(20,6000);
    expect(imageDimensions(png,'image/png')).toEqual({width:8000,height:6000});
    expect(imageDimensions(new Uint8Array([255,216,255,192,0,17,8,0x02,0x58,0x03,0x20,3,1,17,0,2,17,1,3,17,1,255,217]),'image/jpeg')).toEqual({width:800,height:600});
    const rotated=new Uint8Array([255,216,255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0,255,192,0,17,8,0x02,0x58,0x03,0x20,3,1,17,0,2,17,1,3,17,1,255,217]);
    expect(imageDimensions(rotated,'image/jpeg')).toEqual({width:600,height:800});
    expect(imageDimensions(bytes,'text/plain')).toBeNull();
  });
});
describe('Acervo com vínculos, filtros e observações',()=>{
  it('only includes birds with files, resolves older health/photo links and preserves base separation',()=>{
    const state=emptyState(),one=bird(state,'01'),two=bird(state,'02'),empty=bird(state,'03'),demo=bird(state,'D1','demo');
    const healthFile=archive(state),photoFile=archive(state,{title:'Foto antiga'});
    state.health.push({id:randomUUID(),scope:'real',birdId:one.id,date:'2026-10-01',kind:'exame',title:'Exame',notes:'',weightGrams:null,professional:'',author:'',attachmentIds:[healthFile.id]});
    two.photoId=photoFile.id;archive(state,{birdId:demo.id},'demo');
    const groups=groupAttachments(state,'real',filterAttachments(state,'real'));
    expect(groups.map(group=>group.key).sort()).toEqual([one.id,two.id].sort());
    expect(groups.some(group=>group.key===empty.id||group.key===demo.id)).toBe(false);
    expect(attachmentBirdIds(state,'real',healthFile)).toEqual([one.id]);
    expect(filterAttachments(state,'real',{text:'joao'}).map(value=>value.id)).toEqual([healthFile.id]);
    expect(filterAttachments(state,'real',{species:'Calopsita',birdStatus:'manejo'})).toHaveLength(2);
  });
  it('finds sale documents under each linked bird and the client without losing the original sale group',()=>{
    const state=emptyState(),one=bird(state,'01'),two=bird(state,'02'),contactId=randomUUID(),saleId=randomUUID();
    state.contacts.push({id:contactId,scope:'real',kind:'cliente',name:'Cliente João',phone:'',email:'',address:'',taxId:'',notes:'',interest:''});
    state.sales.push({id:saleId,scope:'real',number:'V-1',contactId,date:'2026-10-01',status:'vendida',items:[one,two].map(value=>({id:randomUUID(),kind:'ave',refId:value.id,description:value.identification,quantity:1,unitCents:1000})),discountCents:0,feeCents:0,totalCents:2000,notes:'',deliveryDate:'',statusHistory:[]});
    const document=archive(state,{saleId});
    expect(attachmentBirdIds(state,'real',document).sort()).toEqual([one.id,two.id].sort());
    expect(groupAttachments(state,'real',[document],'contact')[0]).toMatchObject({key:contactId,title:'Cliente João'});
    expect(groupAttachments(state,'real',[document],'sale')[0]).toMatchObject({key:saleId,title:'V-1'});
    expect(filterAttachments(state,'real',{text:'cliente joao'})).toEqual([document]);
  });
  it('filters dates, format, category, validity and current versions while retaining earlier originals',()=>{
    const state=emptyState(),first=archive(state,{validUntil:'2026-10-01'}),next=archive(state,{title:'Revisado',date:'2026-10-05',previousId:first.id,validUntil:'2026-12-31'});
    const snapshot=structuredClone(first);
    expect(filterAttachments(state,'real',{versions:'current'})).toEqual([next]);
    expect(filterAttachments(state,'real',{from:'2026-10-04',to:'2026-10-06',category:'Exame',mime:'text/plain'})).toEqual([next]);
    expect(filterAttachments(state,'real',{validity:'expired'},'2026-10-09')).toEqual([first]);
    expect(filterAttachments(state,'real',{validity:'valid'},'2026-10-09')).toEqual([next]);
    expect(state.attachments[0]).toEqual(snapshot);
  });
  it('edits notes and metadata without accepting byte/link changes and rejects cross-base edits',()=>{
    const state=emptyState(),one=bird(state,'01'),document=archive(state,{birdId:one.id}),original=structuredClone(document);
    documentsHandler(state,'real','attachment.updateMetadata',{...document,title:'Exame revisado',notes:'Retorno agendado',base64:'BBBB',sha256:'0'.repeat(64),birdId:null});
    expect(document).toEqual({...original,title:'Exame revisado',notes:'Retorno agendado'});
    const snapshot=structuredClone(state);
    expect(()=>documentsHandler(state,'demo','attachment.updateMetadata',{...document,notes:'Mudança indevida'})).toThrow(/nesta base/);
    expect(()=>documentsHandler(state,'real','attachment.updateMetadata',{...document,date:'2026-02-30'})).toThrow(/Data inválida/);
    expect(state).toEqual(snapshot);
  });
});
