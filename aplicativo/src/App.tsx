import { APP_VERSION } from './domain/types';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Bird, Heart, Egg, Network, CalendarDays, Users, ShoppingBag, Wallet, Package, Files, BarChart3, Palette, Settings as SettingsIcon, LockKeyhole, RefreshCw, Download, Bug, Home, Menu, BookOpen, Activity, Clock, Plus, ArrowLeft } from 'lucide-react';
import Breeding from './modules/Breeding';
import Commercial from './modules/Commercial';
import Documents from './modules/Documents';
import Settings, { backupVault } from './modules/Settings';
import { Vault } from './lib/storage';
import { synchronizeVault } from './lib/synchronize';
import { syncFailureLabel } from './lib/sync';
import { maintainVault } from './lib/maintenance';
import { applyCommand } from './domain/engine';
import { money, today, dateLabel } from './domain/shared';
import { accountBalance, billOutstanding, salePaid, stockBalance } from './domain/commercial';
import type { State, Scope, ModuleProps } from './domain/types';
import ThemeToggle from './components/ThemeToggle';
import BirdCollection from './components/BirdCollection';
import WebShortcuts from './components/WebShortcuts';
import GlobalSearch from './components/GlobalSearch';
import { BiometricsButton } from './components/BiometricAccess';
import type { NavigationTarget } from './domain/ui-target';
import { historyStatuses, pushNavigation, sectorForTarget, taskTarget, type NavigationEntry, type Sector } from './lib/navigation';

const nav=[
 {id:'home',label:'Hoje',icon:Home,group:'Visão geral'},
 {id:'birds',label:'Aves',icon:Bird,group:'Criatório'},
 {id:'pairs',label:'Casais',icon:Heart,group:'Criatório'},
 {id:'breeding',label:'Reprodução',icon:Egg,group:'Criatório'},
 {id:'family',label:'Parentesco',icon:Network,group:'Criatório'},
 {id:'health',label:'Saúde e manejo',icon:Activity,group:'Criatório'},
 {id:'tasks',label:'Agenda',icon:CalendarDays,group:'Criatório'},
 {id:'contacts',label:'Pessoas',icon:Users,group:'Comercial'},
 {id:'sales',label:'Vendas e reservas',icon:ShoppingBag,group:'Comercial'},
 {id:'finance',label:'Financeiro',icon:Wallet,group:'Comercial'},
 {id:'stock',label:'Materiais',icon:Package,group:'Comercial'},
 {id:'reports',label:'Relatórios',icon:BarChart3,group:'Central'},
 {id:'documents',label:'Documentos',icon:Files,group:'Central'},
 {id:'booklet',label:'Caderneta do pet',icon:BookOpen,group:'Central'},
 {id:'arts',label:'Identidade visual',icon:Palette,group:'Central'},
 {id:'backup',label:'Backup e recuperação',icon:Download,group:'Sistema'},
 {id:'sync',label:'Sincronização',icon:RefreshCw,group:'Sistema'},
 {id:'settings',label:'Configurações',icon:SettingsIcon,group:'Sistema'},
 {id:'updates',label:'Atualizações',icon:RefreshCw,group:'Sistema'},
 {id:'support',label:'Reportar problema',icon:Bug,group:'Sistema'},
] as const;
type View=typeof nav[number]['id'];
const hints:Partial<Record<View,string>>={home:'Criatório e comercial, com seus registros em um só lugar.',birds:'Ficha, história e vínculos de cada ave.',sales:'Reserva, pagamento e entrega acompanhados separadamente.',finance:'Dinheiro recebido, obrigações e conferência de contas.',booklet:'Revise as informações que serão entregues ao tutor.',sync:'Registros locais e conexão privada entre seus aparelhos.'};

export default function App(){
 const [vault]=useState(()=>new Vault()),[exists,setExists]=useState<boolean|null>(null),[state,setState]=useState<State|null>(null),[scope,setScope]=useState<Scope>('real'),[view,setView]=useState<View>('home'),[search,setSearch]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[drawer,setDrawer]=useState(false),[syncText,setSyncText]=useState('Local · offline disponível');
 const [target,setTarget]=useState<NavigationTarget>({view:'home'}),[sector,setSector]=useState<Sector>('breeding'),[history,setHistory]=useState<NavigationEntry[]>([]);
 const targets=useRef(new Map<string,NavigationTarget>()),searches=useRef(new Map<string,string>()),positions=useRef(new Map<string,number>()),request=useRef(0);
 // Preserve lightweight list context while unmounting inactive modules and their old file-bearing state.
 const uiContexts=useRef(new Map<string,Map<string,unknown>>()),backHandler=useRef<()=>void>(()=>{});
 const sessionVersion=useRef(0),sidebarRef=useRef<HTMLElement|null>(null);
 const backupRunning=useRef(false),stateRef=useRef(state);stateRef.current=state;
 const notify=useCallback((text:string)=>setMessage(text),[]);
 useEffect(()=>{if(!drawer)return;const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')setDrawer(false);};window.addEventListener('keydown',closeOnEscape);return()=>window.removeEventListener('keydown',closeOnEscape);},[drawer]);
 useEffect(()=>{vault.exists().then(setExists).catch(e=>notify(e.message));},[vault,notify]);
 const lock=useCallback(()=>{sessionVersion.current++;stateRef.current=null;vault.lock();setState(null);setSearch('');setMessage('');setDrawer(false);setTarget({view:'home'});setView('home');setSector('breeding');setHistory([]);uiContexts.current.clear();targets.current.clear();searches.current.clear();positions.current.clear();},[vault]);
 useEffect(()=>{const back=()=>backHandler.current();window.addEventListener('recanto:native-back',back);return()=>window.removeEventListener('recanto:native-back',back);},[]);
 const command=useCallback(async(action:string,data:unknown)=>{const generation=sessionVersion.current;const result=await vault.mutate(s=>applyCommand(s,scope,action,data));if(generation===sessionVersion.current&&stateRef.current)setState(current=>current&&current.revision>result.state.revision?current:result.state);return result.id;},[scope,vault]);
 useEffect(()=>{
  if(!state)return;let cancelled=false;
  const update=async()=>{const generation=sessionVersion.current;try{const result=await maintainVault(vault,async()=>{const meta=await vault.metadata();return meta.sync?await synchronizeVault(vault):null;});if(!result){setSyncText('Local · offline disponível');return;}if(cancelled||generation!==sessionVersion.current)return;if(result.status==='conflict'){setSyncText('Conflito pendente');return;}if(result.state)setState(result.state);setSyncText(result.pending?'Alterações aguardando conexão':'Sincronização em dia');}catch(error){if(!cancelled&&generation===sessionVersion.current)setSyncText(syncFailureLabel(error));}};
  const timer=setInterval(update,30000);window.addEventListener('online',update);update();return()=>{cancelled=true;clearInterval(timer);window.removeEventListener('online',update);};
 },[!!state,vault]);
 useEffect(()=>{if(!state||backupRunning.current)return;const due=!state.settings.lastBackupAt||Date.now()-new Date(state.settings.lastBackupAt).valueOf()>state.settings.backupDays*86400000;if(!due)return;backupRunning.current=true;const generation=sessionVersion.current;(async()=>{try{const saved=await maintainVault(vault,async()=>{const current=await vault.load();if(current.settings.lastBackupAt&&Date.now()-new Date(current.settings.lastBackupAt).valueOf()<=current.settings.backupDays*86400000)return {state:current};const result=await backupVault(vault,current);return vault.mutate(s=>applyCommand(s,scope,'backup.record',result));});if(generation===sessionVersion.current&&stateRef.current)setState(current=>current&&current.revision>saved.state.revision?current:saved.state);}catch(error){if(stateRef.current)notify('Backup automático pendente: '+(error instanceof Error?error.message:'verifique o armazenamento.'));}finally{backupRunning.current=false;}})();},[state?.settings.lastBackupAt,vault,scope,notify]);
 const acceptUnlocked=(data:State)=>{sessionVersion.current++;stateRef.current=data;setState(data);setExists(true);setMessage('');};
 async function unlockPassword(password:string){acceptUnlocked(await vault.unlock(password));}
 async function unlock(e:FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;const fd=new FormData(e.currentTarget),password=String(fd.get('password'));setBusy(true);setMessage('');try{if(!exists&&password!==fd.get('confirmation'))throw new Error('A confirmação da senha não corresponde.');acceptUnlocked(exists?await vault.unlock(password):await vault.create(password));}catch(error){notify(error instanceof Error?error.message:'Não foi possível abrir a base.');}finally{setBusy(false);}}
 if(!state)backHandler.current=()=>window.dispatchEvent(new Event('recanto:native-root-back'));
 if(!state)return <main className="gate"><div className="gate-appearance"><ThemeToggle/></div><form className="gate-card stack" onSubmit={unlock}><img className="gate-logo" src="/artes/01_Principal/Logo_Colorida_Transparente_1254px.png" alt="Recanto das Asas"/><span className="eyebrow">GESTÃO PRIVADA DO CRIATÓRIO</span><h1>{exists?'Abra seus registros':'Crie sua base privada'}</h1><p>{exists?'Seus registros ficam criptografados neste aparelho. Use a senha escolhida para desbloqueá-los.':'Comece com o criatório vazio e use a demonstração quando quiser explorar. A senha protege os registros e seus backups.'}</p><label className="field">Senha da base<input name="password" type="password" autoComplete={exists?'current-password':'new-password'} minLength={exists?1:10} required disabled={busy||exists===null}/></label>{!exists&&<label className="field">Confirmar senha<input name="confirmation" type="password" autoComplete="new-password" minLength={10} required disabled={busy||exists===null}/></label>}<p className="muted">Guarde a senha em local seguro. Não há recuperação automática. Para usar outro aparelho, abra a base com a mesma senha e configure a sincronização ou restaure seu backup.</p>{message&&<p className="error" role="alert">{message}</p>}<button className="button" disabled={busy||exists===null}>{busy?'Abrindo…':exists?'Desbloquear':'Criar base privada'}</button>{exists&&<BiometricsButton onUnlockPassword={unlockPassword} notify={notify} disabled={busy} onBusyChange={setBusy}/>}<span className="gate-footer"><LockKeyhole size={16}/> Versão {APP_VERSION} · Português do Brasil</span></form></main>;
 const viewKey=(name:string,space=scope)=>space+':'+name;
 const openMenus=()=>{if(sidebarRef.current){sidebarRef.current.scrollTop=0;sidebarRef.current.scrollLeft=0;}setDrawer(true);};
 const closeNavigationPanels=()=>sidebarRef.current?.querySelectorAll<HTMLDetailsElement>('.nav-menu,.session-menu').forEach(panel=>{panel.open=false;});
 const restoreScroll=(position:number)=>requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:position,behavior:'instant'})));
 const navigate=(destination:NavigationTarget)=>{
  if(!nav.some(item=>item.id===destination.view))return;
  const next=destination.view as View,key=viewKey(next),currentKey=viewKey(view);
  searches.current.set(currentKey,search);positions.current.set(currentKey,window.scrollY);
  const nextSector=sectorForTarget(destination,sector);
  const changes=next!==view||nextSector!==sector||Object.keys(destination).some(key=>!['view','request'].includes(key));
  if(changes)setHistory(old=>pushNavigation(old,{target,sector,scope,scroll:window.scrollY,search}));
  const resolved={...destination,request:++request.current};targets.current.set(key,resolved);
  setTarget(resolved);setView(next);setSector(nextSector);setSearch(destination.filter||destination.birdId||destination.saleId||destination.contactId||destination.attachmentId||destination.issuedDocumentId?'':searches.current.get(key)??'');setDrawer(false);closeNavigationPanels();
  restoreScroll(destination.birdId||destination.saleId||destination.contactId||destination.createAction?0:positions.current.get(key)??0);
 };
 const select=(next:View)=>navigate({view:next});
 const openBird=(birdId:string)=>navigate({view:'birds',birdId});
 const createBird=()=>navigate({view:'birds',createAction:'bird'});
 const switchSector=(next:Sector)=>navigate({view:'home',filter:next});
 const goBack=()=>{
  const nativeDialog=Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')).find(dialog=>!dialog.closest('[hidden]'));
  if(nativeDialog){if(nativeDialog.dispatchEvent(new Event('cancel',{cancelable:true})))nativeDialog.close();return;}
  const otherDialog=Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(dialog=>!dialog.closest('[hidden]'));
  if(otherDialog){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return;}
  if(drawer){setDrawer(false);return;}
  const event=new CustomEvent('recanto:back',{cancelable:true});
  if(!window.dispatchEvent(event))return;
  const previous=history.at(-1);
  if(previous){positions.current.set(viewKey(view),window.scrollY);searches.current.set(viewKey(view),search);setHistory(old=>old.slice(0,-1));setView(previous.target.view as View);setTarget(previous.target);setSector(previous.sector);setSearch(previous.search??searches.current.get(viewKey(previous.target.view))??'');targets.current.set(viewKey(previous.target.view),previous.target);restoreScroll(previous.scroll);}
  else if(view!=='home')navigate({view:'home',filter:sector});
  else window.dispatchEvent(new CustomEvent('recanto:native-root-back'));
 };
 backHandler.current=goBack;
 const changeScope=(next:Scope)=>{if(next===scope)return;closeNavigationPanels();searches.current.set(viewKey(view),search);positions.current.set(viewKey(view),window.scrollY);setScope(next);setSearch(searches.current.get(viewKey(view,next))??'');setTarget(targets.current.get(viewKey(view,next))??{view});setDrawer(false);setHistory([]);restoreScroll(positions.current.get(viewKey(view,next))??0);};
 const generation=sessionVersion.current;const commitState=(next:State)=>{if(generation===sessionVersion.current&&stateRef.current)setState(next);};
 const activeKey=viewKey(view);
 let uiContext=uiContexts.current.get(activeKey);
 if(!uiContext){uiContext=new Map<string,unknown>();uiContexts.current.set(activeKey,uiContext);}
 const props:RoutedProps={state,scope,command,notify,search,target,navigate,back:goBack,uiContext};
 const current=nav.find(n=>n.id===view)!;
 const homeLabel=sector==='commercial'?'Resumo':'Hoje';
 const currentLabel=view==='home'?homeLabel:current.label;
 const renderNavigationItem=(item:typeof nav[number])=><button key={item.id} className={view===item.id?'nav-item active':'nav-item'} aria-current={view===item.id?'page':undefined} onClick={()=>select(item.id)}><item.icon size={20} aria-hidden="true"/><span>{item.id==='home'?homeLabel:item.label}</span></button>;
 const primaryIds=sector==='breeding'?['home','birds','breeding','health','tasks']:['home','sales','contacts','finance','stock'];
 const groupItems=[{label:'Reprodução e parentesco',items:nav.filter(item=>['pairs','family'].includes(item.id))},{label:sector==='breeding'?'Acessar Comercial':'Acessar Criatório',items:nav.filter(item=>!primaryIds.includes(item.id)&&!['pairs','family'].includes(item.id)&&['Visão geral','Criatório','Comercial'].includes(item.group))},{label:'Central',items:nav.filter(item=>item.group==='Central')},{label:'Configurações e suporte',items:nav.filter(item=>item.group==='Sistema')}];
 const createActions:Partial<Record<View,string>>={home:sector==='commercial'?'sale':'bird',birds:'bird',pairs:'pair',breeding:'pair',family:'bird',health:'health',tasks:'task',contacts:'contact',sales:'sale',finance:'bill',stock:'purchase'};
 const createCurrent=()=>navigate({view:view==='home'?(sector==='commercial'?'sales':'birds'):view,createAction:createActions[view]});
 const areaSearch:Partial<Record<View,string>>={home:sector==='commercial'?'Buscar vendas':'Buscar aves',birds:'Buscar aves',family:'Buscar aves',pairs:'Buscar casais',breeding:'Buscar reprodução',health:'Buscar saúde e manejo',tasks:'Buscar tarefas',contacts:'Buscar pessoas',sales:'Buscar vendas',finance:'Buscar movimentações',stock:'Buscar materiais',documents:'Buscar documentos',booklet:'Buscar cadernetas',reports:'Buscar relatórios',arts:'Buscar identidade visual'};
 const searchLabel=areaSearch[view];
 return <div className="app-layout simplified-layout"><aside ref={sidebarRef} className={'sidebar '+(drawer?'open':'')}><a href="#" className="brand" onClick={event=>{event.preventDefault();navigate({view:'home',filter:sector});}}><img src="/artes/01_Principal/Logo_Colorida_Transparente_1254px.png" alt="Recanto das Asas"/><span>Recanto das Asas<small>Gestão integrada</small></span></a>
 <div className="sector-control" role="group" aria-label="Setor de trabalho"><button type="button" aria-pressed={sector==='breeding'} onClick={()=>switchSector('breeding')}><Bird size={18} aria-hidden="true"/>Criatório</button><button type="button" aria-pressed={sector==='commercial'} onClick={()=>switchSector('commercial')}><ShoppingBag size={18} aria-hidden="true"/>Comercial</button></div>
 <nav id="main-navigation" aria-label="Navegação principal"><span className="nav-section-label">{sector==='breeding'?'Criatório':'Comercial'}</span>{primaryIds.map(id=>renderNavigationItem(nav.find(item=>item.id===id)!))}{groupItems.filter(group=>group.items.length).map(group=><details key={group.label} className="nav-menu" open={drawer||undefined}><summary>{group.label}</summary><div className="nav-popover">{group.items.map(renderNavigationItem)}</div></details>)}</nav>
 <div className="sidebar-footer"><ThemeToggle compact/><details className="session-menu" open={drawer||undefined}><summary aria-label="Abrir controles da base"><LockKeyhole size={20} aria-hidden="true"/><span>Base privada</span></summary><div className="session-panel"><div className="scope-control" role="group" aria-label="Espaço de registros"><button aria-pressed={scope==='real'} className={scope==='real'?'selected':''} onClick={()=>changeScope('real')}>Meu criatório</button><button aria-pressed={scope==='demo'} className={scope==='demo'?'selected':''} onClick={()=>changeScope('demo')}>Demonstração</button></div><button className="sync-label" onClick={()=>select('sync')}><span className="status-dot"/>{syncText}</button><button className="button secondary lock" aria-label="Bloquear" onClick={lock}><LockKeyhole size={16}/><span>Bloquear</span></button></div></details></div></aside>{drawer&&<button className="drawer-backdrop" aria-label="Fechar menu" onClick={()=>setDrawer(false)}/>}
 <div className="workspace"><header className="topbar"><span className="mobile-brand">Recanto das Asas<small>{sector==='breeding'?'Criatório':'Comercial'} · {scope==='demo'?'Demonstração':'Meu criatório'}</small></span><button className="icon-button mobile-menu" aria-label="Abrir menu" aria-controls="main-navigation" aria-expanded={drawer} onClick={openMenus}><Menu/></button></header>
 <main className="main-content"><div className="page-title"><div><span className="eyebrow">{sector==='breeding'?'CRIATÓRIO':'COMERCIAL'}</span><h1>{currentLabel}</h1><p className="muted">{view==='home'?(sector==='breeding'?'Tarefas e acompanhamento do plantel presente.':'Vendas, recebimentos e entregas da mesma base de registros.'):hints[view]??'Registros organizados para consultar e acompanhar.'}</p></div><div className="page-actions"><GlobalSearch state={state} scope={scope} navigate={navigate}/>{createActions[view]&&<button type="button" className="button contextual-new" onClick={createCurrent}><Plus size={18} aria-hidden="true"/>Novo</button>}{history.length>0&&<button type="button" className="button secondary" aria-label="Voltar ao contexto anterior" onClick={goBack}><ArrowLeft size={18} aria-hidden="true"/>Voltar</button>}</div></div>
 {searchLabel&&<label className="search-field area-search">{searchLabel}<input value={search} onChange={event=>{setSearch(event.target.value);searches.current.set(activeKey,event.target.value);}} placeholder={view==='birds'||view==='home'&&sector==='breeding'?'Nome, anilha ou espécie':view==='sales'?'Número, pessoa ou ave':'Digite para filtrar esta área'} type="search"/></label>}
 {scope==='demo'&&<div className="demo-banner"><strong>Demonstração · dados fictícios</strong><span>Os exemplos ficam separados dos registros do seu criatório.</span>{!state.birds.some(b=>b.scope==='demo')&&<button className="button secondary" onClick={()=>command('initializeDemo',{}).catch(e=>notify(e.message))}>Criar exemplos fictícios</button>}</div>}
 {message&&<div className="message" role="status"><span>{message}</span><button className="icon-button" aria-label="Dispensar mensagem" onClick={()=>setMessage('')}>×</button></div>}
 <div key={activeKey} className="cached-view" data-view={view}><RoutedModule props={props} vault={vault} commitState={commitState} sector={sector}/></div>
 <footer className="footer"><span>Recanto das Asas · {APP_VERSION}</span><span>{scope==='demo'?'Exemplos fictícios':'Seu criatório'} · Fuso America/Sao_Paulo</span></footer></main></div><WebShortcuts currentView={view} sector={sector} onNavigate={next=>navigate({view:next,...next==='home'?{filter:'breeding'}:{}})} onCommercial={()=>switchSector('commercial')} onOpenMenus={openMenus} menusExpanded={drawer}/></div>;
}

type RoutedProps=ModuleProps&{target?:NavigationTarget;navigate:(target:NavigationTarget)=>void;back:()=>void};
function RoutedModule({props,vault,commitState,sector}:{props:RoutedProps;vault:Vault;commitState:(state:State)=>void;sector:Sector}){
 const view=props.target?.view??'home';
 if(view==='home')return <Overview {...props} sector={sector}/>;
 if(['birds','pairs','breeding','family','health','tasks'].includes(view))return <Breeding {...props} view={view as 'birds'} initialBirdId={props.target?.birdId??null} initialCreate={props.target?.createAction==='bird'}/>;
 if(['contacts','sales','finance','stock'].includes(view))return <Commercial {...props} view={view as 'contacts'}/>;
 if(['reports','documents','booklet','arts'].includes(view))return <Documents {...props} view={view as 'reports'}/>;
 return <Settings {...props} vault={vault} setState={commitState} view={view as 'settings'}/>;
}

function Overview({state,scope,search,sector,navigate}:RoutedProps&{sector:Sector}){
 const birds=state.birds.filter(b=>b.scope===scope),present=birds.filter(b=>!historyStatuses.has(b.status)),historical=birds.filter(b=>historyStatuses.has(b.status));
 const pairs=state.pairs.filter(p=>p.scope===scope&&!p.endDate),clutches=state.clutches.filter(c=>c.scope===scope&&!c.endDate),eggs=state.eggs.filter(e=>e.scope===scope&&e.status==='incubando');
 const tasks=state.tasks.filter(t=>t.scope===scope&&!t.done).slice().sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
 const sales=state.sales.filter(s=>s.scope===scope&&['vendida','entregue'].includes(s.status));
 const salesTotal=sales.reduce((sum,s)=>sum+s.totalCents,0);
 const saleBills=state.bills.filter(b=>b.scope===scope&&b.direction==='receber'&&b.saleId&&!b.cancelled);
 const receipts=state.payments.filter(p=>p.scope===scope&&!p.reversed&&saleBills.some(b=>b.id===p.billId)).reduce((sum,p)=>sum+p.amountCents,0);
 const outstanding=saleBills.reduce((sum,b)=>sum+billOutstanding(state,scope,b),0);
 const deliveries=state.sales.filter(s=>s.scope===scope&&s.status==='vendida');
 const overdue=state.bills.filter(b=>b.scope===scope&&!b.cancelled&&b.dueDate<today()&&billOutstanding(state,scope,b)>0);
 const lowStock=state.products.filter(p=>p.scope===scope&&stockBalance(state,scope,p.id)<=p.minimum);
 const matchingBirds=present.filter(b=>[b.name,b.identification,b.species,b.mutation,b.microchip,b.enclosure].join(' ').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
 const statistics=sector==='breeding'?[
  {name:'Aves presentes',value:String(present.length),target:{view:'birds',filter:'present'},icon:Bird,note:'Plantel presente no criatório'},
  {name:'Casais ativos',value:String(pairs.length),target:{view:'breeding',filter:'active-pairs'},icon:Heart,note:'Casais sem encerramento'},
  {name:'Posturas abertas',value:String(clutches.length),target:{view:'breeding',filter:'open-clutches'},icon:Egg,note:eggs.length+' ovos em acompanhamento'},
  {name:'Tarefas pendentes',value:String(tasks.length),target:{view:'tasks',filter:'pending'},icon:CalendarDays,note:tasks.filter(t=>t.dueDate<today()).length+' vencidas'},
 ]:[
  {name:'Vendas realizadas',value:money(salesTotal),target:{view:'sales',filter:'sales'},icon:ShoppingBag,note:sales.length+' vendas · todo o histórico'},
  {name:'Recebido em vendas',value:money(receipts),target:{view:'finance',filter:'sale-receipts'},icon:Wallet,note:'Pagamentos confirmados sem estorno'},
  {name:'Em aberto de vendas',value:money(outstanding),target:{view:'finance',filter:'sale-receivables'},icon:Clock,note:'Saldo das obrigações de vendas'},
  {name:'Entregas pendentes',value:String(deliveries.length),target:{view:'sales',filter:'deliveries'},icon:Package,note:'Vendas realizadas ainda sem entrega'},
 ];
 return <div className="stack overview"><div className="row dashboard-heading"><h2>{sector==='breeding'?'Hoje no criatório':'Resumo comercial'}</h2><span className="muted">{dateLabel(today())}</span></div>
 <div className="dashboard-stats">{statistics.map(card=><button type="button" className="stat-card" key={card.name} onClick={()=>navigate(card.target)}><span className="stat-icon"><card.icon size={20} aria-hidden="true"/></span><span className="stat-content"><strong>{card.value}</strong><span>{card.name}</span><small>{card.note}</small></span></button>)}</div>
 {sector==='breeding'?<div className="dashboard-columns"><section className="card overview-birds"><div className="row"><h3>Plantel presente ({present.length})</h3><button className="link" onClick={()=>navigate({view:'birds',filter:'present'})}>Ver todas as aves</button></div><BirdCollection birds={matchingBirds.slice(0,8)} state={state} scope={scope} onOpen={birdId=>navigate({view:'birds',birdId})} variant="compact" onCreate={()=>navigate({view:'birds',createAction:'bird'})}/><div className="row dashboard-list-footer"><button className="link" onClick={()=>navigate({view:'birds',filter:'history'})}>Consultar histórico ({historical.length})</button><button className="link" onClick={()=>navigate({view:'birds',filter:'present'})}>Abrir plantel completo</button></div></section>
 <div className="dashboard-side"><section className="card"><div className="row"><h3>Tarefas e lembretes</h3><button className="link" onClick={()=>navigate({view:'tasks',filter:'pending'})}>Ver agenda</button></div>{tasks.slice(0,4).map(task=><div className="home-task" key={task.id}><button type="button" className="task-preview" onClick={()=>navigate(taskTarget(task))}><CalendarDays size={18} aria-hidden="true"/><span><strong>{task.title}</strong><small>{dateLabel(task.dueDate)}{task.dueDate<today()?' · Vencida':''}</small></span></button><button type="button" className="link" onClick={()=>navigate({view:'tasks',taskId:task.id})} aria-label={`Ver tarefa: ${task.title}`}>Detalhes</button></div>)}{!tasks.length&&<p className="muted">Nenhuma tarefa pendente.</p>}</section>
 <section className="card"><div className="row"><h3>Posturas ativas</h3><button className="link" onClick={()=>navigate({view:'breeding',filter:'open-clutches'})}>Ver reprodução</button></div>{clutches.slice(0,4).map(clutch=><button type="button" className="task-preview" key={clutch.id} onClick={()=>navigate({view:'breeding',clutchId:clutch.id,pairId:clutch.pairId})}><Egg size={18} aria-hidden="true"/><span><strong>{state.pairs.find(pair=>pair.id===clutch.pairId)?.name??'Casal'}</strong><small>Início {dateLabel(clutch.startDate)} · {state.eggs.filter(egg=>egg.scope===scope&&egg.clutchId===clutch.id).length} ovos</small></span></button>)}{!clutches.length&&<p className="muted">Nenhuma postura aberta.</p>}</section></div></div>:
 <div className="dashboard-columns commercial-overview"><section className="card"><div className="row"><h3>Reservas e entregas</h3><button className="link" onClick={()=>navigate({view:'sales'})}>Ver operações</button></div>{state.sales.filter(sale=>sale.scope===scope&&['reservada','vendida'].includes(sale.status)&&[sale.number,state.contacts.find(contact=>contact.id===sale.contactId)?.name,...sale.items.map(item=>item.description)].join(' ').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).slice(0,8).map(sale=><button type="button" className="task-preview commercial-operation-preview" key={sale.id} onClick={()=>navigate({view:'sales',saleId:sale.id})}><span><strong>{sale.number} · {state.contacts.find(contact=>contact.id===sale.contactId)?.name??'Sem contato'}</strong><small>{sale.status} · {sale.items.map(item=>item.description).join(' · ')}</small></span><span>{money(sale.totalCents)}<small>{money(salePaid(state,scope,sale.id))} recebidos</small></span></button>)}{!state.sales.some(sale=>sale.scope===scope&&['reservada','vendida'].includes(sale.status))&&<p className="muted">Nenhuma reserva ou entrega pendente.</p>}</section>
 <div className="dashboard-side"><section className="card"><h3>Ações frequentes</h3><div className="quick-actions"><button className="button" onClick={()=>navigate({view:'sales',createAction:'sale'})}>Registrar venda</button><button className="button secondary" onClick={()=>navigate({view:'sales',createAction:'reservation'})}>Registrar reserva</button><button className="button secondary" onClick={()=>navigate({view:'contacts',createAction:'contact'})}>Cadastrar pessoa</button><button className="button secondary" onClick={()=>navigate({view:'stock',createAction:'purchase'})}>Registrar compra</button></div></section>
 <section className="card"><h3>Pendências comerciais</h3><button className="task-preview" onClick={()=>navigate({view:'finance',filter:'overdue'})}><Clock size={18} aria-hidden="true"/><span><strong>{overdue.length} contas vencidas</strong><small>A pagar e a receber · {money(overdue.reduce((sum,bill)=>sum+billOutstanding(state,scope,bill),0))}</small></span></button><button className="task-preview" onClick={()=>navigate({view:'stock',filter:'low-stock'})}><Package size={18} aria-hidden="true"/><span><strong>{lowStock.length} materiais no mínimo</strong><small>Saldo menor ou igual ao mínimo cadastrado</small></span></button></section></div></div>}
 <section className="card shared-access"><h3>Acessos compartilhados</h3><div className="row"><button className="button secondary" onClick={()=>navigate({view:'reports'})}>Relatórios</button><button className="button secondary" onClick={()=>navigate({view:'documents'})}>Documentos</button><button className="button secondary" onClick={()=>navigate({view:'booklet'})}>Caderneta do pet</button></div></section></div>;
}
