import type { Vault } from './storage';
// Backups/restores and background synchronization share a queue in one session.
// Interactive writes retain their independent revision checks across tabs/devices.
const queues=new WeakMap<Vault,Promise<void>>();
export function maintainVault<T>(vault:Vault,task:()=>Promise<T>):Promise<T>{
 const prior=queues.get(vault)??Promise.resolve();const running=prior.then(task);
 const tail=running.then(()=>{},()=>{});queues.set(vault,tail);
 void tail.then(()=>{if(queues.get(vault)===tail)queues.delete(vault);});
 return running;
}
