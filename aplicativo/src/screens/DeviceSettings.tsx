import { Bell, Laptop, MonitorSmartphone, Moon, UserRound } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { State } from '../domain/types';
import { defaultDeviceName, setPreferences, usePreferences } from '../lib/preferences';
import { desktopBridge, requestNotificationPermission } from '../lib/notify';
import { ThemeSwitch } from '../shell/ThemeSwitch';
import { Button, Panel } from '../ui/bits';
import { Stagger } from '../ui/motion';
import { cn } from '../ui/cn';

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl p-3 transition-colors hover:bg-secondary">
    <span><span className="block text-sm font-semibold">{label}</span>{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span>
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-teal' : 'bg-border')}>
      <span className={cn('absolute top-0.5 size-5 rounded-full bg-card shadow-soft transition-all', checked ? 'left-[22px]' : 'left-0.5')}/>
    </button>
  </label>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1.5 text-sm font-semibold">{label}{children}</label>;
}
const input = 'h-11 rounded-2xl bg-secondary px-4 py-0 leading-[2.75rem] text-sm font-medium outline-none ring-teal/50 focus:ring-2';

/** Preferences of this device: name, notifications, tray, report reminders, theme. */
export default function DeviceSettings({ state, notify }: { state: State; notify: (m: string) => void }) {
  const prefs = usePreferences();
  const desktop = desktopBridge();
  const [tray, setTray] = useState(prefs.keepInTray);
  useEffect(() => { if (desktop) void desktop.getKeepInTray().then(setTray).catch(() => {}); }, []);
  async function enableNotifications(v: boolean) {
    if (v) {
      const ok = await requestNotificationPermission().catch(() => false);
      if (!ok) { notify('O aparelho não permitiu avisos. Libere as notificações do Recanto das Asas nas configurações do sistema.'); return; }
    }
    setPreferences({ notifications: v });
  }
  return <Stagger className="ui mb-6 grid gap-4 xl:grid-cols-2">
    <Panel title="Você e este aparelho" subtitle="Só neste aparelho; não vai para a sincronização">
      <div className="flex flex-col gap-4">
        <Field label="Como devo te chamar"><span className="relative"><UserRound className="absolute left-4 top-3.5 size-4 text-muted-foreground"/><input className={cn(input, 'w-full pl-11')} value={prefs.ownerName} maxLength={60} placeholder="Ex.: Elber" onChange={e => setPreferences({ ownerName: e.target.value })}/></span></Field>
        <Field label="Nome deste aparelho"><span className="relative"><MonitorSmartphone className="absolute left-4 top-3.5 size-4 text-muted-foreground"/><input className={cn(input, 'w-full pl-11')} value={prefs.deviceName} maxLength={60} placeholder={defaultDeviceName()} onChange={e => setPreferences({ deviceName: e.target.value })}/></span></Field>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-secondary p-3"><span className="flex items-center gap-2 text-sm font-semibold"><Moon className="size-4"/>Aparência</span><ThemeSwitch tone="light"/></div>
        {desktop && <Toggle checked={tray} label="Manter o app sempre aberto perto do relógio" hint="Ao fechar a janela, o app só minimiza. Os avisos chegam na hora e a sincronização continua. Para sair de vez, use o ícone perto do relógio → Sair."
          onChange={v => { setTray(v); setPreferences({ keepInTray: v }); void desktop.setKeepInTray(v).then(() => notify(v ? 'O app vai ficar perto do relógio ao fechar a janela.' : 'Ao fechar a janela, o app será encerrado.')); }}/>}
        {!desktop && <p className="flex items-start gap-2 rounded-2xl bg-tint-sky p-3 text-xs"><Laptop className="mt-0.5 size-4 shrink-0"/>No Windows, você pode deixar o app sempre aberto perto do relógio para os avisos chegarem na hora.</p>}
      </div>
    </Panel>
    <Panel title="Avisos na barra de notificação" subtitle="Feitos pelo próprio app, sem internet" action={<Bell className="size-5 text-teal"/>}>
      <div className="flex flex-col gap-1">
        <Toggle checked={prefs.notifications} onChange={v => void enableNotifications(v)} label="Receber avisos" hint="No celular os avisos chegam mesmo com o app fechado."/>
        <div className={cn('flex flex-col gap-1 transition-opacity', !prefs.notifications && 'pointer-events-none opacity-50')}>
          <Toggle checked={prefs.notifyTasks} onChange={v => setPreferences({ notifyTasks: v })} label="Tarefas da agenda"/>
          <Toggle checked={prefs.notifyHatch} onChange={v => setPreferences({ notifyHatch: v })} label="Eclosões previstas" hint="Um dia antes e no dia."/>
          <Toggle checked={prefs.notifyBills} onChange={v => setPreferences({ notifyBills: v })} label="Contas vencendo" hint="A pagar e a receber, um dia antes e no dia."/>
          <Toggle checked={prefs.notifyDeliveries} onChange={v => setPreferences({ notifyDeliveries: v })} label="Entregas e reservas" hint="Na data marcada."/>
          <div className="grid grid-cols-2 gap-3 p-3">
            <Field label="Avisar tarefas antes"><select className={input} value={prefs.taskAdvanceMinutes} onChange={e => setPreferences({ taskAdvanceMinutes: Number(e.target.value) })}>{[0, 5, 15, 30, 60, 120].map(m => <option key={m} value={m}>{m === 0 ? 'No horário' : m < 60 ? `${m} minutos` : `${m / 60} ${m === 60 ? 'hora' : 'horas'}`}</option>)}</select></Field>
            <Field label="Avisos do dia às"><select className={input} value={prefs.dailyNoticeHour} onChange={e => setPreferences({ dailyNoticeHour: Number(e.target.value) })}>{[6, 7, 8, 9, 10, 12, 18].map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></Field>
          </div>
        </div>
        <Toggle checked={prefs.reportReminders} onChange={v => setPreferences({ reportReminders: v })} label="Sugerir relatórios" hint="No fim do dia, da semana, do mês e do ano. Nada é gerado sozinho."/>
        <div className="px-3 pt-2"><Button variant="secondary" size="sm" onClick={() => void requestNotificationPermission().then(ok => notify(ok ? 'Avisos liberados neste aparelho.' : 'O aparelho não permitiu avisos.'))}>Testar permissão de avisos</Button></div>
      </div>
    </Panel>
  </Stagger>;
}
