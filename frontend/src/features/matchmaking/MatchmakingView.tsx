type MatchmakingViewProps = {
  status?: string;
};

export function MatchmakingView({ status }: MatchmakingViewProps) {
  return (
    <section>
      <h2>Matchmaking</h2>
      <p>{status ?? 'Aguardando status_matchmaking...'}</p>
    </section>
  );
}
