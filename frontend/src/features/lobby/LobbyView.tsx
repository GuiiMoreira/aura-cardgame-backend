type LobbyViewProps = {
  deckId: string;
  onDeckChange: (value: string) => void;
  onBuscarPartida: () => void;
};

export function LobbyView({ deckId, onDeckChange, onBuscarPartida }: LobbyViewProps) {
  return (
    <section>
      <h2>Lobby</h2>
      <p>Selecione o deck e entre no matchmaking.</p>
      <input value={deckId} onChange={(e) => onDeckChange(e.target.value)} placeholder="deck-basico" />
      <button onClick={onBuscarPartida}>Buscar partida</button>
    </section>
  );
}
