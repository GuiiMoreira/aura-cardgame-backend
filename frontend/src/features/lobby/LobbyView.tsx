import type { UserDeck } from '../../services/firestoreData';

type LobbyViewProps = {
  decks: UserDeck[];
  deckId: string;
  deckValidationError?: string;
  onDeckChange: (value: string) => void;
  onBuscarPartida: () => void;
  onOpenCollection: () => void;
  onOpenDeckBuilder: () => void;
  onLogout: () => void;
};

export function LobbyView({
  decks,
  deckId,
  deckValidationError,
  onDeckChange,
  onBuscarPartida,
  onOpenCollection,
  onOpenDeckBuilder,
  onLogout,
}: LobbyViewProps) {
  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>HUB Principal</h2>
      <p>Escolha seu próximo passo: montar deck, explorar coleção ou entrar em batalha.</p>

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <button onClick={onBuscarPartida} disabled={!deckId}>
          ⚔️ Encontrar partida
        </button>
        <button onClick={onOpenDeckBuilder}>🧩 Construir deck</button>
        <button onClick={onOpenCollection}>📚 Ver coleção</button>
        <button disabled title="Em breve">
          🛒 Loja (em breve)
        </button>
        <button onClick={onLogout}>🚪 Logout</button>
      </div>

      <hr style={{ margin: '16px 0' }} />
      <p>Deck ativo para matchmaking:</p>
      <select value={deckId} onChange={(e) => onDeckChange(e.target.value)}>
        <option value="">Selecione...</option>
        {decks.map((deck) => (
          <option key={deck.id} value={deck.id}>
            {deck.nome ?? deck.id} ({deck.id})
          </option>
        ))}
      </select>

      {deckValidationError ? <p style={{ color: 'crimson' }}>{deckValidationError}</p> : null}
    </section>
  );
}
