import type { UserDeck } from '../../services/firestoreData';

type LobbyViewProps = {
  decks: UserDeck[];
  deckId: string;
  deckValidationError?: string;
  onDeckChange: (value: string) => void;
  onBuscarPartida: () => void;
  onOpenCollection: () => void;
  onOpenDeckBuilder: () => void;
};

export function LobbyView({
  decks,
  deckId,
  deckValidationError,
  onDeckChange,
  onBuscarPartida,
  onOpenCollection,
  onOpenDeckBuilder,
}: LobbyViewProps) {
  return (
    <section>
      <h2>Lobby</h2>
      <p>Selecione um baralho salvo e entre no matchmaking.</p>
      <select value={deckId} onChange={(e) => onDeckChange(e.target.value)}>
        <option value="">Selecione...</option>
        {decks.map((deck) => (
          <option key={deck.id} value={deck.id}>
            {deck.nome ?? deck.id} ({deck.id})
          </option>
        ))}
      </select>
      <button onClick={onBuscarPartida} disabled={!deckId}>
        Buscar partida
      </button>
      <button onClick={onOpenCollection}>Coleção</button>
      <button onClick={onOpenDeckBuilder}>Deck builder</button>
      {deckValidationError ? <p style={{ color: 'crimson' }}>{deckValidationError}</p> : null}
    </section>
  );
}
