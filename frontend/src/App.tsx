import { useEffect, useMemo, useRef, useState } from 'react';
import { LobbyView } from './features/lobby/LobbyView';
import { LoginView } from './features/login/LoginView';
import { MatchmakingView } from './features/matchmaking/MatchmakingView';
import { MatchRoomView } from './features/match-room/MatchRoomView';
import { MockSocketClient, startMockServer } from './mock/mock-server';
import { createSocketClient, type AuraSocket } from './socket/socket-client';
import type { FlowStep, MatchEventsState, MatchState, SessionState } from './types/app-state';
import { SOCKET_CONTRACT_VERSION } from './contracts/socket-contracts';
import { API_URL } from './config';

export default function App() {
  const [step, setStep] = useState<FlowStep>('login');
  const [token, setToken] = useState('');
  const [userId, setUserId] = useState('jogador_local');
  const [deckId, setDeckId] = useState('deck-basico');
  const [mockMode, setMockMode] = useState(true);
  const [events, setEvents] = useState<MatchEventsState>({});
  const [session, setSession] = useState<SessionState | null>(null);
  const [match, setMatch] = useState<MatchState>({});

  const socketRef = useRef<AuraSocket | MockSocketClient | null>(null);

  const status = useMemo(() => events.matchmakingStatus?.mensagem, [events.matchmakingStatus]);

  const connectSocket = (newSession: SessionState) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    if (mockMode) {
      const mock = new MockSocketClient();
      startMockServer(mock, newSession.userId);
      socketRef.current = mock;
      return;
    }

    socketRef.current = createSocketClient({
      url: API_URL,
      token: newSession.token,
    });
  };

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.on('status_matchmaking', (payload) => {
      setEvents((prev) => ({ ...prev, matchmakingStatus: payload }));
      setStep('matchmaking');
    });

    socket.on('partida_encontrada', (payload) => {
      setEvents((prev) => ({ ...prev, partidaEncontrada: payload }));
      setMatch({ sala: payload.sala, estado: payload.estado });
      setStep('match-room');
    });

    socket.on('estado_atualizado', (payload) => {
      setEvents((prev) => ({ ...prev, estadoAtualizado: payload }));
      setMatch({ sala: payload.sala, estado: payload.estado });
    });

    socket.on('fim_de_jogo', (payload) => {
      setEvents((prev) => ({ ...prev, fimDeJogo: payload }));
    });

    socket.on('erro_partida', (payload) => {
      setEvents((prev) => ({ ...prev, erroPartida: payload }));
    });
  }, [session]);

  const handleLogin = () => {
    const newSession = { token, userId, deckId };
    setSession(newSession);
    connectSocket(newSession);
    setStep('lobby');
  };

  const handleBuscarPartida = () => {
    socketRef.current?.emit('buscar_partida', { deckId });
  };

  const handlePassTurn = () => {
    if (!match.sala) return;
    socketRef.current?.emit('passar_turno', { sala: match.sala });
  };

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 880, margin: '0 auto' }}>
      <h1>Aura Cardgame Frontend</h1>
      <small>Contrato Socket {SOCKET_CONTRACT_VERSION}</small>
      <p>
        Fluxo: <strong>{step}</strong> {mockMode ? '(mock ativo)' : '(backend online)'}
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

      {step === 'match-room' ? (
        <MatchRoomView
          sala={match.sala}
          estado={match.estado}
          winnerId={events.fimDeJogo?.vencedor}
          onPassTurn={handlePassTurn}
        />
      ) : null}

      {events.erroPartida ? <p style={{ color: 'crimson' }}>Erro: {events.erroPartida.motivo}</p> : null}
    </main>
  );
}
