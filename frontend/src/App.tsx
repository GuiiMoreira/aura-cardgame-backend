import { useMemo, useRef, useState } from 'react';
import { LobbyView } from './features/lobby/LobbyView';
import { LoginView } from './features/login/LoginView';
import { MatchmakingView } from './features/matchmaking/MatchmakingView';
import { PartidaView } from './features/partida/PartidaView';
import { ResultadoView } from './features/resultado/ResultadoView';
import { MockSocketClient, startMockServer } from './mock/mock-server';
import {
  SocketClientService,
  createSocketClient,
  type AuraSocket,
  type MatchEventHandlers,
} from './services/socketClient';
import type { ConnectionState, FlowStep, MatchEventsState, MatchState, SessionState } from './types/app-state';
import { SOCKET_CONTRACT_VERSION } from './contracts/socket-contracts';
import { API_URL } from './config';

const INITIAL_CONNECTION: ConnectionState = {
  connected: false,
  reconnecting: false,
  reconnectAttempts: 0,
};

export default function App() {
  const [step, setStep] = useState<FlowStep>('login');
  const [token, setToken] = useState('');
  const [userId, setUserId] = useState('jogador_local');
  const [deckId, setDeckId] = useState('deck-basico');
  const [mockMode, setMockMode] = useState(true);
  const [events, setEvents] = useState<MatchEventsState>({});
  const [session, setSession] = useState<SessionState | null>(null);
  const [match, setMatch] = useState<MatchState>({});
  const [connection, setConnection] = useState<ConnectionState>(INITIAL_CONNECTION);

  const socketRef = useRef<SocketClientService | null>(null);

  const status = useMemo(() => events.matchmakingStatus?.mensagem, [events.matchmakingStatus]);

  const createTransport = (newSession: SessionState): AuraSocket | MockSocketClient => {
    if (mockMode) {
      const mock = new MockSocketClient();
      startMockServer(mock, newSession.userId);
      return mock;
    }

    return createSocketClient({
      url: API_URL,
      token: newSession.token,
    });
  };

  const subscribeEvents = (service: SocketClientService, newSession: SessionState) => {
    const handlers: MatchEventHandlers = {
      onConnected: () => setConnection((prev) => ({ ...prev, connected: true, reconnecting: false })),
      onDisconnected: (reason) =>
        setConnection((prev) => ({
          ...prev,
          connected: false,
          reconnecting: true,
          reconnectingMessage: `Conexão perdida (${reason}). Tentando retorno...`,
        })),
      onReconnectAttempt: (attempt) =>
        setConnection((prev) => ({
          ...prev,
          reconnecting: true,
          reconnectAttempts: attempt,
          reconnectingMessage: `Tentativa de reconexão #${attempt}`,
        })),
      onReconnectSuccess: () =>
        setConnection((prev) => ({
          ...prev,
          connected: true,
          reconnecting: false,
          reconnectingMessage: undefined,
        })),
      onReconnectFailed: () =>
        setConnection((prev) => ({
          ...prev,
          connected: false,
          reconnecting: false,
          reconnectingMessage: 'Não foi possível reconectar.',
          abandonmentDefeat: true,
        })),
      onStatusMatchmaking: (payload) => {
        setEvents((prev) => ({ ...prev, matchmakingStatus: payload }));
        setStep('matchmaking');
      },
      onPartidaEncontrada: (payload) => {
        setEvents((prev) => ({ ...prev, partidaEncontrada: payload }));
        setMatch({ sala: payload.sala, estado: payload.estado });
        setStep('partida');
      },
      onEstadoAtualizado: (payload) => {
        setEvents((prev) => ({ ...prev, estadoAtualizado: payload }));
        setMatch({ sala: payload.sala, estado: payload.estado });
      },
      onFimDeJogo: (payload) => {
        setEvents((prev) => ({ ...prev, fimDeJogo: payload }));
        setStep('resultado');
      },
      onErroPartida: (payload) => {
        setEvents((prev) => ({ ...prev, erroPartida: payload }));
        if (payload.motivo.toLowerCase().includes('abandono')) {
          setConnection((prev) => ({ ...prev, abandonmentDefeat: true }));
          setStep('resultado');
        }
      },
    };

    service.subscribe(handlers);
    service.reconectarPartida(match.sala ?? `mock_${newSession.userId}`);
  };

  const handleLogin = () => {
    const newSession = { token, userId, deckId };
    socketRef.current?.disconnect();

    const transport = createTransport(newSession);
    const service = new SocketClientService(transport);

    socketRef.current = service;
    setSession(newSession);
    setConnection(INITIAL_CONNECTION);
    subscribeEvents(service, newSession);

    setStep('lobby');
  };

  const handleBuscarPartida = () => socketRef.current?.buscarPartida(deckId);

  const handlePassTurn = () => {
    if (!match.sala) return;
    socketRef.current?.passarTurno(match.sala);
  };

  const handlePlayCard = (cartaId: string) => {
    if (!match.sala) return;
    socketRef.current?.jogarCarta(match.sala, cartaId);
  };

  const handleAttackFortress = (atacantesIds: string[]) => {
    if (!match.sala) return;
    socketRef.current?.atacarFortaleza(match.sala, atacantesIds);
  };

  const handleDeclareAttack = (atacanteId: string, alvoId: string) => {
    if (!match.sala) return;
    socketRef.current?.declararAtaque(match.sala, atacanteId, alvoId);
  };

  const handleAttackSelectionChange = (attackSelection: NonNullable<MatchState['attackSelection']>) => {
    setMatch((prev) => ({ ...prev, attackSelection }));
  };

  const handleTryReconnect = () => {
    socketRef.current?.reconectarPartida(match.sala);
    setConnection((prev) => ({ ...prev, reconnecting: true }));
  };

  const handleBackToLobby = () => {
    setEvents({});
    setMatch({});
    setConnection((prev) => ({ ...prev, abandonmentDefeat: false }));
    setStep('lobby');
  };

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 980, margin: '0 auto' }}>
      <h1>Aura Cardgame Frontend</h1>
      <small>Contrato Socket {SOCKET_CONTRACT_VERSION}</small>
      <p>
        Fluxo: <strong>{step}</strong> {mockMode ? '(mock ativo)' : '(backend online)'}
      </p>
      <p>
        Conexão: <strong>{connection.connected ? 'online' : 'offline'}</strong>
        {connection.reconnecting ? ` · reconectando (${connection.reconnectAttempts} tentativa(s))` : ''}
      </p>

      {step === 'login' ? (
        <LoginView
          token={token}
          userId={userId}
          mockMode={mockMode}
          onTokenChange={setToken}
          onUserIdChange={setUserId}
          onMockToggle={setMockMode}
          onSubmit={handleLogin}
        />
      ) : null}

      {step === 'lobby' ? (
        <LobbyView deckId={deckId} onDeckChange={setDeckId} onBuscarPartida={handleBuscarPartida} />
      ) : null}

      {step === 'matchmaking' ? <MatchmakingView status={status} /> : null}

      {step === 'partida' ? (
        <PartidaView
          sala={match.sala}
          estado={match.estado}
          attackSelection={match.attackSelection}
          userId={session?.userId ?? userId}
          isReconnecting={connection.reconnecting}
          reconnectMessage={connection.reconnectingMessage}
          onPassTurn={handlePassTurn}
          onPlayCard={handlePlayCard}
          onAttackFortress={handleAttackFortress}
          onDeclareAttack={handleDeclareAttack}
          onAttackSelectionChange={handleAttackSelectionChange}
          onTryReconnect={handleTryReconnect}
        />
      ) : null}

      {step === 'resultado' ? (
        <ResultadoView
          winnerId={events.fimDeJogo?.vencedor}
          localUserId={session?.userId ?? userId}
          abandonmentDefeat={connection.abandonmentDefeat}
          reason={events.erroPartida?.motivo}
          onBackToLobby={handleBackToLobby}
        />
      ) : null}

      {events.erroPartida ? <p style={{ color: 'crimson' }}>Erro: {events.erroPartida.motivo}</p> : null}
    </main>
  );
}
