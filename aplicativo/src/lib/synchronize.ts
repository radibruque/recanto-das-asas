import { SyncClient, SyncConflictError } from './sync';
import { Vault, type Envelope } from './storage';
import type { State } from '../domain/types';
export type SyncResult={status:'synced';state?:State;pending:number}|{status:'conflict';conflict:{envelope:Envelope;revision:number}};
const active=new WeakMap<Vault,Promise<SyncResult>>();
export function synchronizeVault(vault:Vault):Promise<SyncResult>{const existing=active.get(vault);if(existing)return existing;const operation=perform(vault).finally(()=>active.delete(vault));active.set(vault,operation);return operation;}
async function perform(vault:Vault):Promise<SyncResult>{
 const baseline=await vault.metadata();if(!baseline.sync)throw new Error('Configure o serviço privado primeiro.');const config=baseline.sync,client=new SyncClient(config);
 try {
  if(!baseline.queue.length){const remote=await client.download();if(remote.envelope){if(remote.revision!==config.remoteRevision){const state=await vault.adopt(remote.envelope as Envelope,remote.revision,baseline.localRevision);return {status:'synced',state,pending:0};}return {status:'synced',pending:0};}if(config.remoteRevision!==0)throw new Error('O servidor não contém a base anterior. Preserve seus backups e verifique o serviço.');await vault.queueCurrent();}
  const queued=(await vault.metadata()).queue;
  for(const pending of queued){const item=await vault.prepareUpload(pending.operationId,config);if(!item)continue;const receipt=await client.upload({expectedRevision:item.expectedRevision!,operationId:item.operationId,envelope:item.envelope});await vault.acknowledge(item.operationId,receipt.revision,config);if(receipt.currentRevision>receipt.revision){const remote=await client.download();if(remote.envelope)return {status:'conflict',conflict:{envelope:remote.envelope as Envelope,revision:remote.revision}};throw new Error('A base remota mudou durante a sincronização.');}}
  return {status:'synced',pending:(await vault.metadata()).queue.length};
 }catch(error){if(error instanceof SyncConflictError&&error.snapshot.envelope)return {status:'conflict',conflict:{envelope:error.snapshot.envelope as Envelope,revision:error.snapshot.revision}};throw error;}
}
