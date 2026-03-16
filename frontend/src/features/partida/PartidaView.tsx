import type { EstadoPartida } from '../../contracts/socket-contracts';
import { FieldView } from './components/FieldView';
import { HandView } from './components/HandView';

type PartidaViewProps = {
  sala?: string;
  userId: string;
  estado?: EstadoPartida;
  isReconnecting: boolean;
  reconnectMessage?: string;
  onPassTurn: () => void;
  onTryReconnect: () => void;
};

export function PartidaView({
  sala,
  userId,
  estado,
  isReconnecting,
  reconnectMessage,
  onPassTurn,
  onTryReconnect,
}: PartidaViewProps) {
  const player = estado?.jogadores[userId];
  const enemyId = Object.keys(estado?.jogadores ?? {}).find((id) => id !== userId);

  return (
    <section>
      <h2>Partida</h2>
      <p>Sala: {sala ?? 'sem sala ativa'}</p>
      <p>
        Turno atual: <strong>{estado?.turno ?? '-'}</strong>
      </p>
      <p>Fase: {estado?.fase ?? '-'}</p>

      {isReconnecting ? (
        <div style={{ padding: 10, border: '1px solid #f0a500', marginBottom: 12 }}>
          <strong>Reconectando...</strong>
          <p>{reconnectMessage ?? 'Tentando retomar partida'}</p>
          <button onClick={onTryReconnect}>Tentar retorno agora</button>
        </div>
      ) : null}

      <button onClick={onPassTurn} disabled={!sala || isReconnecting}>
        Passar turno
      </button>

      <hr />
      <h3>Jogadores</h3>
      <p>
        Você ({userId}) - Vida: {player?.vida ?? '-'}
      </p>
      {enemyId ? <p>Oponente ({enemyId}) - Vida: {estado?.jogadores[enemyId]?.vida ?? '-'}</p> : null}

      <HandView title="Sua mão" cards={player?.mao ?? []} />

      {Object.entries(estado?.campo ?? {}).map(([owner, cards]) => (
        <FieldView key={owner} ownerId={owner} cards={cards} />
      ))}
    </section>
  );
}
