import { recallUiRoute, rememberUiRoute, useUiState, writeUiContext } from '../lib/ui-context';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Attachment, ModuleProps } from '../domain/types';
import { attachmentBirdIds, attachmentSourceLabel, attachmentStatus, filterAttachments, groupAttachments, type AttachmentFilters, type AttachmentGrouping } from '../domain/documents';
import { birdLabel, dateLabel, today } from '../domain/shared';
import { AttachmentPreview } from '../components/DirectAttachments';

const formatNames:Record<string,string>={'application/pdf':'PDF','image/png':'Foto PNG','image/jpeg':'Foto JPG','text/plain':'Texto'};
const metadata=(attachment:Attachment)=>({title:attachment.title,category:attachment.category,date:attachment.date,issuer:attachment.issuer,reference:attachment.reference,validUntil:attachment.validUntil,notes:attachment.notes,shareWithCustomer:attachment.shareWithCustomer});
type Metadata=ReturnType<typeof metadata>;
const emptyMetadata:Metadata={title:'',category:'',date:'',issuer:'',reference:'',validUntil:'',notes:'',shareWithCustomer:false};
type LibraryRoute={filters:AttachmentFilters;groupBy:AttachmentGrouping;selectedGroup:string;selectedId:string;linkedBird:string;linkedSale:string};

export default function DocumentsLibrary({state,scope,command,notify,search,target,uiContext}:ModuleProps) {
  const hydrated=useRef(false);
  if(!hydrated.current){
    hydrated.current=true;
    const remembered=recallUiRoute<LibraryRoute>(uiContext,'document-library-routes',target?.request);
    if(remembered)for(const [key,value] of Object.entries(remembered))writeUiContext(uiContext,`documents:${key}`,value);
  }
  const [filters,setFilters]=useUiState<AttachmentFilters>(uiContext,'documents:filters',{versions:'current'}),[groupBy,setGroupBy]=useUiState<AttachmentGrouping>(uiContext,'documents:groupBy','bird'),[selectedGroup,setSelectedGroup]=useUiState(uiContext,'documents:selectedGroup',''),[selectedId,setSelectedId]=useUiState(uiContext,'documents:selectedId','');
  const [editing,setEditing]=useState<Metadata>(emptyMetadata),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  const [linkedBird,setLinkedBird]=useUiState(uiContext,'documents:linkedBird',''),[linkedSale,setLinkedSale]=useUiState(uiContext,'documents:linkedSale','');
  const attachments=useMemo(()=>filterAttachments(state,scope,{...filters,text:search}).filter(file=>(!linkedBird||attachmentBirdIds(state,scope,file).includes(linkedBird))&&(!linkedSale||file.saleId===linkedSale)),[state,scope,filters,search,linkedBird,linkedSale]);
  const groups=useMemo(()=>groupAttachments(state,scope,attachments,groupBy),[state,scope,attachments,groupBy]);
  const activeGroup=groups.find(group=>group.key===selectedGroup);
  const selected=state.attachments.find(attachment=>attachment.id===selectedId&&attachment.scope===scope);
  const scopedAttachments=state.attachments.filter(attachment=>attachment.scope===scope);
  const categories=[...new Set(scopedAttachments.map(attachment=>attachment.category))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const linkedBirdIds=new Set(scopedAttachments.flatMap(attachment=>attachmentBirdIds(state,scope,attachment)));
  const linkedBirds=state.birds.filter(bird=>bird.scope===scope&&linkedBirdIds.has(bird.id));
  const species=[...new Set(linkedBirds.map(bird=>bird.species))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const statuses=[...new Set(linkedBirds.map(bird=>bird.status))].sort((a,b)=>a.localeCompare(b,'pt-BR'));

  useEffect(()=>{
    if(selectedId&&selected){setEditing(metadata(selected));setError('');if(!dialog.current?.open)dialog.current?.showModal();}
    else if(dialog.current?.open)dialog.current.close();
    // Keep an in-progress edit intact while another part of the base is updated.
  },[selectedId,scope]);
  useEffect(()=>()=>{rememberUiRoute(uiContext,'document-library-routes',target?.request,{filters,groupBy,selectedGroup,selectedId,linkedBird,linkedSale});},[uiContext,target?.request,filters,groupBy,selectedGroup,selectedId,linkedBird,linkedSale]);
  useEffect(()=>{
    const remembered=recallUiRoute<LibraryRoute>(uiContext,'document-library-routes',target?.request);
    if(remembered){setFilters(remembered.filters);setGroupBy(remembered.groupBy);setSelectedGroup(remembered.selectedGroup);setSelectedId(remembered.selectedId);setLinkedBird(remembered.linkedBird);setLinkedSale(remembered.linkedSale);return;}
    const original=target?.issuedDocumentId?state.documents.find(document=>document.id===target.issuedDocumentId&&document.scope===scope):undefined;
    if(original||target?.birdId||target?.saleId){setLinkedBird(original?original.birdId||'':target?.birdId||'');setLinkedSale(original?original.saleId||'':target?.saleId||'');setSelectedGroup('');setSelectedId('');}
    if(target?.attachmentId)setSelectedId(target.attachmentId);
  },[target?.request]);
  function filter<K extends keyof AttachmentFilters>(key:K,value:AttachmentFilters[K]) {setFilters(current=>({...current,[key]:value}));setSelectedGroup('');}
  async function save() {
    if(!selected)return;
    setBusy(true);setError('');
    try {await command('attachment.updateMetadata',{id:selected.id,...editing});notify('Observações e informações do documento atualizadas. O arquivo original foi preservado.');}
    catch(error){setError(error instanceof Error?error.message:'Não foi possível salvar as informações.');}
    finally{setBusy(false);}
  }
  return <section className="stack documents-library">
    {(linkedBird||linkedSale)&&<div className="notice"><span>Arquivos do registro relacionado</span><button className="button secondary" onClick={()=>{setLinkedBird('');setLinkedSale('');}}>Mostrar todo o acervo</button></div>}
    <div className="card document-library-filters"><h3 className="section-title">Acervo de documentos e fotos</h3><p>Arquivos anexados nos cadastros e registros. Abra uma ave ou um grupo para consultar os arquivos, visualizar os originais e acrescentar observações.</p>
      <div className="form-grid filter-grid">
        <label>Organizar por<select value={groupBy} onChange={event=>{setGroupBy(event.target.value as AttachmentGrouping);setSelectedGroup('');}}><option value="bird">Ave</option><option value="category">Categoria</option><option value="contact">Cliente ou fornecedor</option><option value="sale">Venda ou reserva</option><option value="source">Menu de origem</option></select></label>
        <label>Categoria<select value={filters.category||''} onChange={event=>filter('category',event.target.value)}><option value="">Todas</option>{categories.map(category=><option key={category}>{category}</option>)}</select></label>
        <label>Espécie<select value={filters.species||''} onChange={event=>filter('species',event.target.value)}><option value="">Todas</option>{species.map(value=><option key={value}>{value}</option>)}</select></label>
        <label>Situação da ave<select value={filters.birdStatus||''} onChange={event=>filter('birdStatus',event.target.value)}><option value="">Todas</option>{statuses.map(value=><option key={value}>{value}</option>)}</select></label>
        <label>Formato<select value={filters.mime||''} onChange={event=>filter('mime',event.target.value)}><option value="">Todos</option>{Object.entries(formatNames).map(([mime,label])=><option key={mime} value={mime}>{label}</option>)}</select></label>
        <label>Validade<select value={filters.validity||'all'} onChange={event=>filter('validity',event.target.value as AttachmentFilters['validity'])}><option value="all">Todas</option><option value="valid">Sem vencimento ou dentro da validade</option><option value="expired">Vencidos</option></select></label>
        <label>Data inicial<input type="date" value={filters.from||''} onChange={event=>filter('from',event.target.value)}/></label>
        <label>Data final<input type="date" min={filters.from} value={filters.to||''} onChange={event=>filter('to',event.target.value)}/></label>
        <label>Versões<select value={filters.versions||'current'} onChange={event=>filter('versions',event.target.value as AttachmentFilters['versions'])}><option value="current">Versão mais recente de cada arquivo</option><option value="all">Todas, incluindo originais anteriores</option></select></label>
      </div>
      <div className="toolbar"><button type="button" className="button secondary" onClick={()=>{setFilters({versions:'current'});setSelectedGroup('');}}>Limpar filtros</button><span className="muted">{attachments.length} arquivo{attachments.length===1?'':'s'} encontrado{attachments.length===1?'':'s'}</span></div>
    </div>
    {activeGroup?<div className="card document-group"><div className="row record-header"><div><h3 className="section-title">{activeGroup.title}</h3><p className="muted">{activeGroup.subtitle}</p></div><button type="button" className="button secondary" onClick={()=>setSelectedGroup('')}>Voltar aos grupos</button></div>
      <div className="list document-collection">{activeGroup.attachments.map(attachment=><article className="document-card" key={attachment.id}><div className="row"><div><strong>{attachment.title}</strong><p className="muted">{attachment.category} · {formatNames[attachment.mime]||attachment.mime} · {dateLabel(attachment.date)}</p><p className="muted">{attachmentSourceLabel(attachment)} · v{attachment.version} · {attachmentStatus(attachment,today())}</p>{attachment.notes&&<p className="muted">{attachment.notes}</p>}</div><button type="button" className="button secondary" onClick={()=>setSelectedId(attachment.id)}>Detalhes</button></div></article>)}</div>
    </div>:groups.length?<div className="grid document-group-grid">{groups.map(group=><article className="card document-group" key={group.key}><h3 className="section-title">{group.title}</h3><p>{group.subtitle}</p><p>{group.attachments.length} arquivo{group.attachments.length===1?'':'s'} · último registro em {dateLabel(group.attachments[0].date)}</p><div className="toolbar"><button type="button" className="button secondary" onClick={()=>setSelectedGroup(group.key)}>Ver arquivos</button></div></article>)}</div>:<div className="card empty"><p>{scopedAttachments.length?'Nenhum arquivo corresponde aos filtros.':'Nenhum documento ou foto anexado nesta base. Anexe arquivos diretamente ao cadastrar uma ave, um manejo ou outro registro.'}</p></div>}
    <dialog ref={dialog} className="modal" aria-label="Detalhes do documento" onCancel={()=>setSelectedId('')} onClose={()=>setSelectedId('')}>
      {selected&&<div className="stack"><div className="row modal-heading"><h2>Detalhes do documento</h2><button type="button" className="button secondary" disabled={busy} onClick={()=>setSelectedId('')}>Fechar</button></div>
        <AttachmentPreview attachment={selected}/>
        <dl className="record-details"><dt>Ave</dt><dd>{attachmentBirdIds(state,scope,selected).map(id=>birdLabel(state.birds.find(bird=>bird.id===id&&bird.scope===scope))).join(', ')||'Sem vínculo com ave'}</dd><dt>Origem do registro</dt><dd>{attachmentSourceLabel(selected)}</dd><dt>Cliente / fornecedor</dt><dd>{state.contacts.find(contact=>contact.id===(selected.contactId||state.sales.find(sale=>sale.id===selected.saleId&&sale.scope===scope)?.contactId)&&contact.scope===scope)?.name||'Sem vínculo'}</dd><dt>Venda / reserva</dt><dd>{state.sales.find(sale=>sale.id===selected.saleId&&sale.scope===scope)?.number||'Sem vínculo'}</dd><dt>Versão</dt><dd>{selected.version}{selected.previousId?' · original anterior preservado':''}</dd><dt>Integridade</dt><dd className="data-fingerprint">SHA-256: {selected.sha256}</dd></dl>
        <form className="record-form-section" onSubmit={event=>{event.preventDefault();void save();}}><h3 className="section-title">Informações e observações</h3><p className="muted">A edição destas informações preserva o arquivo e os vínculos originais.</p><div className="form-grid filter-grid"><label>Título<input required maxLength={150} disabled={busy} value={editing.title} onChange={event=>setEditing({...editing,title:event.target.value})}/></label><label>Categoria<input required maxLength={150} disabled={busy} value={editing.category} onChange={event=>setEditing({...editing,category:event.target.value})}/></label><label>Data<input type="date" required disabled={busy} value={editing.date} onChange={event=>setEditing({...editing,date:event.target.value})}/></label><label>Validade opcional<input type="date" disabled={busy} value={editing.validUntil} onChange={event=>setEditing({...editing,validUntil:event.target.value})}/></label><label>Emissor<input maxLength={2000} disabled={busy} value={editing.issuer} onChange={event=>setEditing({...editing,issuer:event.target.value})}/></label><label>Referência<input maxLength={2000} disabled={busy} value={editing.reference} onChange={event=>setEditing({...editing,reference:event.target.value})}/></label></div><label>Observações<textarea maxLength={2000} rows={4} disabled={busy} value={editing.notes} onChange={event=>setEditing({...editing,notes:event.target.value})}/></label><label className="check"><input type="checkbox" disabled={busy} checked={editing.shareWithCustomer} onChange={event=>setEditing({...editing,shareWithCustomer:event.target.checked})}/>Pode ser incluído na entrega ao cliente</label>{error&&<p className="error" role="alert">{error}</p>}<div className="toolbar modal-actions"><button type="submit" className="button" disabled={busy}>{busy?'Salvando…':'Salvar observações e informações'}</button></div></form>
      </div>}
    </dialog>
  </section>;
}
