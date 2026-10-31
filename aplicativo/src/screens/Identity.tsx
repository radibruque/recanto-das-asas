import { motion } from 'motion/react';
import { Check, Copy, Download } from 'lucide-react';
import { useState } from 'react';
import { downloadBytes } from '../lib/exports';
import { Button, Panel } from '../ui/bits';
import { Stagger, riseItem } from '../ui/motion';
import { cn } from '../ui/cn';

const palette = [
  { name: 'Azul principal', hex: '#054973', text: 'text-ink-foreground' },
  { name: 'Turquesa', hex: '#078FA8', text: 'text-ink-foreground' },
  { name: 'Azul claro', hex: '#29AAEA', text: 'text-ink-foreground' },
  { name: 'Verde', hex: '#67994B', text: 'text-ink-foreground' },
  { name: 'Amarelo', hex: '#FBC732', text: 'text-ink' },
  { name: 'Azul-marinho do app', hex: '#0B2236', text: 'text-ink-foreground' },
];

const logos = [
  { name: 'Logo colorida', file: '/artes/01_Principal/Logo_Colorida_Transparente_1254px.png', bg: 'bg-card', download: 'Logo_Colorida_Recanto_das_Asas.png', mime: 'image/png' },
  { name: 'Logo vertical branca', file: '/brand/logo-vertical-branco.svg', bg: 'bg-feather', download: 'Logo_Vertical_Branca_Recanto_das_Asas.svg', mime: 'image/svg+xml' },
  { name: 'Símbolo azul', file: '/brand/simbolo-azul.svg', bg: 'bg-tint-sky', download: 'Simbolo_Azul_Recanto_das_Asas.svg', mime: 'image/svg+xml' },
  { name: 'Símbolo branco', file: '/brand/simbolo-branco.svg', bg: 'bg-ink', download: 'Simbolo_Branco_Recanto_das_Asas.svg', mime: 'image/svg+xml' },
  { name: 'Nome branco', file: '/brand/nome-branco.svg', bg: 'bg-ink-2', download: 'Nome_Branco_Recanto_das_Asas.svg', mime: 'image/svg+xml' },
  { name: 'Logo com fundo branco', file: '/artes/01_Principal/Logo_Aprovada_Fundo_Branco.jpg', bg: 'bg-card', download: 'Logo_Fundo_Branco_Recanto_das_Asas.jpg', mime: 'image/jpeg' },
];

/** Identidade visual: main colors (tap to copy) and main logos (download). */
export default function Identity({ notify }: { notify: (m: string) => void }) {
  const [copied, setCopied] = useState('');
  const copy = async (hex: string) => { try { await navigator.clipboard.writeText(hex); setCopied(hex); setTimeout(() => setCopied(''), 1500); } catch { notify(`Código da cor: ${hex}`); } };
  const download = async (l: typeof logos[number]) => { try { const r = await fetch(l.file); if (!r.ok) throw new Error(); await downloadBytes(new Uint8Array(await r.arrayBuffer()), l.download, l.mime); } catch { notify('Não foi possível baixar este arquivo.'); } };
  return <Stagger className="ui flex flex-col gap-4">
    <Panel title="Cores da marca" subtitle="Toque em uma cor para copiar o código">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {palette.map(c => <motion.button type="button" key={c.hex} variants={riseItem} whileHover={{ y: -4 }} whileTap={{ scale: 0.96 }} onClick={() => void copy(c.hex)}
          className={cn('flex aspect-[4/5] flex-col justify-end rounded-3xl p-4 text-left shadow-soft', c.text)} style={{ background: c.hex }}>
          <span className="text-sm font-bold">{c.name}</span>
          <span className="mt-1 flex items-center gap-1.5 font-mono text-xs opacity-90">{copied === c.hex ? <><Check className="size-3.5"/>Copiado</> : <><Copy className="size-3.5"/>{c.hex}</>}</span>
        </motion.button>)}
      </div>
    </Panel>
    <Panel title="Logos principais" subtitle="Arquivos originais para usar em posts, etiquetas e impressão">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {logos.map(l => <motion.div key={l.name} variants={riseItem} className="overflow-hidden rounded-3xl ring-1 ring-border">
          <div className={cn('h-40 p-6', l.bg)}><img src={l.file} alt={l.name} className="h-full w-full object-contain"/></div>
          <div className="flex items-center justify-between gap-2 bg-card p-3"><span className="text-sm font-semibold">{l.name}</span><Button size="sm" variant="secondary" onClick={() => void download(l)}><Download/>Baixar</Button></div>
        </motion.div>)}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">O mascote e os vetores complementares entram aqui quando os arquivos forem enviados.</p>
    </Panel>
  </Stagger>;
}
