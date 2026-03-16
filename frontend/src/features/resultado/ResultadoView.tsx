type ResultadoViewProps = {
  winnerId?: string;
  localUserId: string;
  abandonmentDefeat?: boolean;
  reason?: string;
  onBackToLobby: () => void;
};

export function ResultadoView({
  winnerId,
  localUserId,
  abandonmentDefeat,
  reason,
  onBackToLobby,
}: ResultadoViewProps) {
  const isVictory = winnerId === localUserId && !abandonmentDefeat;

  return (
    <section>
      <h2>Resultado</h2>
      {abandonmentDefeat ? <p>Derrota por abandono.</p> : <p>{isVictory ? 'Vitória!' : 'Derrota.'}</p>}
      <p>Vencedor: {winnerId ?? 'não informado'}</p>
      {reason ? <p>Motivo: {reason}</p> : null}
      <button onClick={onBackToLobby}>Voltar ao lobby</button>
    </section>
  );
}
