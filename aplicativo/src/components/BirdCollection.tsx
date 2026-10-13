import { useMemo } from 'react';
import { Bird as BirdIcon, ChevronRight, Plus } from 'lucide-react';
import type { Bird, Scope, State } from '../domain/types';
import { birdLabel, dateLabel } from '../domain/shared';
import { AttachmentThumbnail } from './DirectAttachments';

type BirdCollectionProps = {
  birds: Bird[];
  state: State;
  scope: Scope;
  onOpen: (birdId: string) => void;
  variant?: 'compact' | 'full';
  onCreate?: () => void;
};

/** Shared presentation of the real plantel; selection opens the existing bird record. */
export default function BirdCollection({ birds, state, scope, onOpen, variant = 'full', onCreate }: BirdCollectionProps) {
  const photos = useMemo(() => new Map(state.attachments.filter(file => file.scope === scope && file.mime.startsWith('image/')).map(file => [file.id, file])), [state.attachments, scope]);
  if (!birds.length) return <div className="bird-list-empty">
    <BirdIcon aria-hidden="true"/>
    <p className="empty muted">Nenhuma ave encontrada neste espaço.</p>
    {onCreate && <button type="button" className="button" onClick={onCreate}><Plus size={18} aria-hidden="true"/>Cadastrar ave</button>}
  </div>;
  return <div className={`bird-list bird-list-${variant}`}>
    <div className="bird-list-heading" aria-hidden="true"><span>Foto</span><span>Nome / anilha</span><span>Espécie</span><span>Sexo / mutação</span><span>Situação</span><span>Recinto</span><span>Nascimento</span><span>Ficha</span></div>
    <ul className="bird-list-items" aria-label="Lista de aves">
      {birds.map(bird => {
        const photo = bird.photoId ? photos.get(bird.photoId) : undefined;
        return <li className="bird-list-row" key={bird.id}>
          <button type="button" className="bird-list-open" onClick={() => onOpen(bird.id)} aria-label={birdLabel(bird)} title={`Abrir ficha de ${birdLabel(bird)}`}>
            <span className="bird-list-photo">{photo ? <AttachmentThumbnail attachment={photo} maxHeight={64}/> : <BirdIcon aria-hidden="true"/>}</span>
            <span className="bird-list-identity"><strong className="bird-list-name">{bird.name || bird.identification}</strong><small className="bird-list-identification">{bird.identification}</small></span>
            <span className="bird-list-data bird-list-species">{bird.species}</span>
            <span className="bird-list-data bird-list-traits"><span>{bird.sex}</span><small>{bird.mutation}</small></span>
            <span className="bird-list-data bird-list-status"><strong className="status-badge">{bird.status}</strong></span>
            <span className="bird-list-data bird-list-enclosure">{bird.enclosure || 'Não informado'}</span>
            <span className="bird-list-data bird-list-birth">{dateLabel(bird.birthDate)}{bird.birthEstimated && <small>Estimado</small>}</span>
            <span className="bird-list-action"><ChevronRight size={18} aria-hidden="true"/></span>
          </button>
        </li>;
      })}
    </ul>
  </div>;
}
