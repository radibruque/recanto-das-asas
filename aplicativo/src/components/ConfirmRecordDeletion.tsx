import { useState } from 'react';
import { RecordDetailsDialog } from './RecordDialog';
import { Button } from '../ui/bits';

export function ConfirmRecordDeletion({title,description,onClose,onConfirm}:{title:string;description:string;onClose:()=>void;onConfirm:()=>Promise<string|undefined>}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function remove(){if(busy)return;setBusy(true);setError('');try{const id=await onConfirm();if(id)onClose();else setError('Não foi possível excluir. Tente novamente.');}catch(e){setError(e instanceof Error?e.message:'Não foi possível excluir.');}finally{setBusy(false);}}
  return <RecordDetailsDialog title={title} onClose={()=>{if(!busy)onClose();}}><p>{description}</p>{error&&<p className="error" role="alert">{error}</p>}<div className="ui flex flex-wrap gap-2"><Button disabled={busy} onClick={()=>void remove()}>{busy?'Excluindo…':'Confirmar exclusão'}</Button><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button></div></RecordDetailsDialog>;
}