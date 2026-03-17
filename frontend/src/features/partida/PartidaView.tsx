import type { EstadoPartida } from '../../contracts/socket-contracts';
import type { MatchState } from '../../types/app-state';

type PartidaViewProps = {
  sala?: string;
  userId: string;
  estado?: EstadoPartida;
  attackSelection?: MatchState['attackSelection'];
  isReconnecting: boolean;
  reconnectMessage?: string;
  onPassTurn: () => void;
  onPlayCard: (cartaId: string) => void;
  onAttackFortress: (atacantesIds: string[]) => void;
  onDeclareAttack: (atacanteId: string, alvoId: string) => void;
  onAttackSelectionChange: (attackSelection: NonNullable<MatchState['attackSelection']>) => void;
  onTryReconnect: () => void;
};

export function PartidaView({
  sala,
  userId,
  estado,
  attackSelection,
  isReconnecting,
  reconnectMessage,
  onPassTurn,
  onPlayCard,
  onAttackFortress,
  onDeclareAttack,
  onAttackSelectionChange,
  onTryReconnect,
}: PartidaViewProps) {
  const player = estado?.jogadores[userId];
  const enemyId = Object.keys(estado?.jogadores ?? {}).find((id) => id !== userId);
  const playerField = estado?.campo?.[userId] ?? [];
  const enemyField = enemyId ? estado?.campo?.[enemyId] ?? [] : [];

  const selectedAtacantes = attackSelection?.atacanteIds ?? [];
  const selectedAtacante = attackSelection?.atacanteId;
  const selectedAlvo = attackSelection?.alvoId;

  const interactionDisabled = isReconnecting || !sala;

  const toggleAtacante = (cardId: string) => {
    const next = selectedAtacantes.includes(cardId)
      ? selectedAtacantes.filter((id) => id !== cardId)
      : [...selectedAtacantes, cardId];

    onAttackSelectionChange({
      atacanteIds: next,
      atacanteId: selectedAtacante,
      alvoId: selectedAlvo,
    });
  };

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

      <button onClick={onPassTurn} disabled={interactionDisabled}>
        Passar turno
      </button>

      <hr />
      <h3>Jogadores</h3>
      <p>
        Você ({userId}) - Vida: {player?.vida ?? '-'}
      </p>
      {enemyId ? <p>Oponente ({enemyId}) - Vida: {estado?.jogadores[enemyId]?.vida ?? '-'}</p> : null}

      <section>
        <h4>Sua mão</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(player?.mao ?? []).length > 0 ? (
            (player?.mao ?? []).map((card) => (
              <div key={card.id} style={{ border: '1px solid #ddd', padding: 8, width: 180 }}>
                <strong>{card.nome ?? card.id}</strong>
                <p>ID: {card.id}</p>
                <button onClick={() => onPlayCard(card.id)} disabled={interactionDisabled}>
                  Jogar
                </button>
              </div>
            ))
          ) : (
            <p>Mão vazia.</p>
          )}
        </div>
      </section>

      <section>
        <h4>Seu campo (seleção para atacar fortaleza)</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {playerField.length > 0 ? (
            playerField.map((card) => {
              const checked = selectedAtacantes.includes(card.id);
              return (
                <label key={card.id} style={{ border: '1px solid #ddd', padding: 8, width: 180 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAtacante(card.id)}
                    disabled={interactionDisabled}
                  />{' '}
                  {card.nome ?? card.id}
                </label>
              );
            })
          ) : (
            <p>Sem cartas no campo.</p>
          )}
        </div>
        <button onClick={() => onAttackFortress(selectedAtacantes)} disabled={interactionDisabled || selectedAtacantes.length === 0}>
          Atacar fortaleza
        </button>
      </section>

      <section>
        <h4>Combate unitário</h4>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <select
            value={selectedAtacante ?? ''}
            onChange={(event) =>
              onAttackSelectionChange({
                atacanteIds: selectedAtacantes,
                atacanteId: event.target.value || undefined,
                alvoId: selectedAlvo,
              })
            }
            disabled={interactionDisabled}
          >
            <option value="">Selecione atacante</option>
            {playerField.map((card) => (
              <option key={card.id} value={card.id}>
                {card.nome ?? card.id}
              </option>
            ))}
          </select>

          <select
            value={selectedAlvo ?? ''}
            onChange={(event) =>
              onAttackSelectionChange({
                atacanteIds: selectedAtacantes,
                atacanteId: selectedAtacante,
                alvoId: event.target.value || undefined,
              })
            }
            disabled={interactionDisabled}
          >
            <option value="">Selecione alvo</option>
            {enemyField.map((card) => (
              <option key={card.id} value={card.id}>
                {card.nome ?? card.id}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => selectedAtacante && selectedAlvo && onDeclareAttack(selectedAtacante, selectedAlvo)}
          disabled={interactionDisabled || !selectedAtacante || !selectedAlvo}
        >
          Declarar ataque
        </button>
      </section>
    </section>
  );
}
