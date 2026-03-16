import type { EstadoPartida } from '../../contracts/socket-contracts';

type MatchRoomViewProps = {
  sala?: string;
  estado?: EstadoPartida;
  winnerId?: string;
  onPassTurn: () => void;
};

const SPECIAL_ABILITIES = ['Instável', 'Congelar', 'Ressurgir'];

export function MatchRoomView({ sala, estado, winnerId, onPassTurn }: MatchRoomViewProps) {
  return (
    <section>
      <h2>Sala de Partida</h2>
      <p>Sala atual: {sala ?? 'sem sala'}</p>
      <button onClick={onPassTurn}>Passar turno</button>
      {winnerId ? <p>Fim de jogo! Vencedor: {winnerId}</p> : null}
      <h3>Estado Atual</h3>
      <pre>{JSON.stringify(estado, null, 2)}</pre>

      <h3>Habilidades especiais</h3>
      <ul>
        {SPECIAL_ABILITIES.map((ability) => (
          <li key={ability}>
            {ability} <em>(em implementação)</em>
          </li>
        ))}
      </ul>
    </section>
  );
}
