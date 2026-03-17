import { useEffect, useMemo, useRef, useState } from 'react';
import { CollectionView } from './features/deck-builder/CollectionView';
import { DeckBuilderView } from './features/deck-builder/DeckBuilderView';
import { LobbyView } from './features/lobby/LobbyView';
import { LoginView } from './features/login/LoginView';
import { RegisterView } from './features/login/RegisterView';
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
import {
  hasFirebaseConfig,
  loginAnonymously,
  loginWithEmailPassword,
  logout,
  registerWithEmailPassword,
  subscribeAuthState,
  type User,
} from './services/firebaseAuth';
import { listCatalogCards, listUserDecks, saveUserDeck, type CatalogCard, type UserDeck } from './services/firestoreData';

const INITIAL_CONNECTION: ConnectionState = {
  connected: false,
  reconnecting: false,
  reconnectAttempts: 0,
};

const CAN_USE_MOCK_MODE = import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK_MODE === 'true';

function mapDeckErrorMessage(motivo?: string) {
  if (!motivo) return undefined;
  if (motivo.toLowerCase().includes('baralho inválido')) {
    return `Seu baralho está inválido para jogar. ${motivo} Abra o deck builder para corrigir (30 cartas, máximo 3 cópias).`;
  }
  return undefined;
}

export default function App() {
  const [step, setStep] = useState<FlowStep>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | undefined>(undefined);

  const [deckId, setDeckId] = useState('');
  const [deckErrorMessage, setDeckErrorMessage] = useState<string | undefined>(undefined);
  const [decks, setDecks] = useState<UserDeck[]>([]);
  const [catalogCards, setCatalogCards] = useState<CatalogCard[]>([]);
  const [selectedDeckForBuilder, setSelectedDeckForBuilder] = useState<UserDeck | undefined>(undefined);

  const [mockMode, setMockMode] = useState(CAN_USE_MOCK_MODE);
  const [events, setEvents] = useState<MatchEventsState>({});
  const [session, setSession] = useState<SessionState | null>(null);
  const [match, setMatch] = useState<MatchState>({});
  const [connection, setConnection] = useState<ConnectionState>(INITIAL_CONNECTION);

  const socketRef = useRef<SocketClientService | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeAuthState((user) => {
      setAuthUser(user);
      setAuthError(undefined);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authUser) {
      setDecks([]);
      setCatalogCards([]);
      setDeckId('');
      return;
    }

    const loadFirestoreData = async () => {
      const [loadedDecks, loadedCatalog] = await Promise.all([listUserDecks(authUser.uid), listCatalogCards()]);
      setDecks(loadedDecks);
      setCatalogCards(loadedCatalog);
      setDeckId((current) => current || loadedDecks[0]?.id || '');
    };

    void loadFirestoreData();
  }, [authUser]);

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
        setMatch((prev) => ({ ...prev, sala: payload.sala, estado: payload.estado }));
      },
      onFimDeJogo: (payload) => {
        setEvents((prev) => ({ ...prev, fimDeJogo: payload }));
        setStep('resultado');
      },
      onErroPartida: (payload) => {
        setEvents((prev) => ({ ...prev, erroPartida: payload }));
        const deckError = mapDeckErrorMessage(payload.motivo);
        if (deckError) {
          setDeckErrorMessage(deckError);
          setStep('deckbuilder');
          return;
        }

        if (payload.motivo.toLowerCase().includes('abandono')) {
          setConnection((prev) => ({ ...prev, abandonmentDefeat: true }));
          setStep('resultado');
        }
      },
    };

    service.subscribe(handlers);
    service.reconectarPartida(match.sala ?? `mock_${newSession.userId}`);
  };

  const handleEmailPasswordLogin = async () => {
    try {
      setAuthError(undefined);
      await loginWithEmailPassword(email, password);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Falha ao autenticar com e-mail/senha.');
    }
  };

  const handleRegister = async () => {
    if (password.length < 6) {
      setAuthError('A senha precisa ter ao menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setAuthError('As senhas não conferem.');
      return;
    }

    try {
      setAuthError(undefined);
      await registerWithEmailPassword(email, password);
      setStep('login');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Falha ao criar conta.');
    }
  };

  const handleAnonymousLogin = async () => {
    try {
      setAuthError(undefined);
      await loginAnonymously();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Falha ao autenticar anonimamente.');
    }
  };

  const handleLogin = async () => {
    if (!authUser) {
      setAuthError('Autentique-se antes de continuar.');
      return;
    }

    if (!deckId) {
      setAuthError('Selecione ou crie um baralho antes de continuar.');
      setStep('deckbuilder');
      return;
    }

    const idToken = await authUser.getIdToken();
    const newSession = { token: idToken, userId: authUser.uid, deckId };
    socketRef.current?.disconnect();

    const transport = createTransport(newSession);
    const service = new SocketClientService(transport as any);

    socketRef.current = service;
    setSession(newSession);
    setConnection(INITIAL_CONNECTION);
    subscribeEvents(service, newSession);

    setStep('lobby');
  };

  const handleBuscarPartida = () => {
    if (!deckId) {
      setDeckErrorMessage('Selecione um baralho antes de buscar partida.');
      return;
    }
    setDeckErrorMessage(undefined);
    socketRef.current?.buscarPartida(deckId);
  };

  const handleSaveDeck = async (id: string, name: string, cartas: string[]) => {
    if (!authUser) {
      throw new Error('Usuário não autenticado.');
    }

    await saveUserDeck(authUser.uid, id, cartas, name);
    const loadedDecks = await listUserDecks(authUser.uid);
    setDecks(loadedDecks);
    setDeckId(id);
    setDeckErrorMessage(undefined);
    setSelectedDeckForBuilder(loadedDecks.find((deck) => deck.id === id));
  };

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

  const handleLogout = async () => {
    socketRef.current?.disconnect();
    setSession(null);
    setMatch({});
    setEvents({});
    setConnection(INITIAL_CONNECTION);
    await logout();
    setStep('login');
  };

  const handleBackToLobby = () => {
    setEvents({});
    setMatch({});
    setConnection((prev) => ({ ...prev, abandonmentDefeat: false }));
    setStep('lobby');
  };

  return (
    <main style={{ fontFamily: 'Inter, sans-serif', maxWidth: 1100, margin: '24px auto', padding: '0 16px' }}>
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
          email={email}
          password={password}
          isAuthenticated={Boolean(authUser)}
          userId={authUser?.uid}
          authError={authError}
          mockMode={mockMode}
          canUseMockMode={CAN_USE_MOCK_MODE}
          canUseFirebaseAuth={hasFirebaseConfig}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onMockToggle={setMockMode}
          onEmailPasswordLogin={handleEmailPasswordLogin}
          onAnonymousLogin={handleAnonymousLogin}
          onGoToRegister={() => setStep('cadastro')}
          onSubmit={() => void handleLogin()}
        />
      ) : null}

      {step === 'cadastro' ? (
        <RegisterView
          email={email}
          password={password}
          confirmPassword={confirmPassword}
          authError={authError}
          canUseFirebaseAuth={hasFirebaseConfig}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onRegister={() => void handleRegister()}
          onBackToLogin={() => setStep('login')}
        />
      ) : null}

      {step === 'lobby' ? (
        <LobbyView
          decks={decks}
          deckId={deckId}
          deckValidationError={deckErrorMessage}
          onDeckChange={(value) => {
            setDeckId(value);
            setDeckErrorMessage(undefined);
          }}
          onBuscarPartida={handleBuscarPartida}
          onOpenCollection={() => setStep('colecao')}
          onOpenDeckBuilder={() => {
            setSelectedDeckForBuilder(decks.find((deck) => deck.id === deckId));
            setStep('deckbuilder');
          }}
          onLogout={() => void handleLogout()}
        />
      ) : null}

      {step === 'colecao' ? <CollectionView cards={catalogCards} onBack={() => setStep('lobby')} /> : null}

      {step === 'deckbuilder' ? (
        <DeckBuilderView
          cards={catalogCards}
          deck={selectedDeckForBuilder}
          onBack={() => setStep('lobby')}
          onSave={handleSaveDeck}
        />
      ) : null}

      {step === 'matchmaking' ? <MatchmakingView status={status} /> : null}

      {step === 'partida' ? (
        <PartidaView
          sala={match.sala}
          estado={match.estado}
          attackSelection={match.attackSelection}
          userId={session?.userId ?? authUser?.uid ?? ''}
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
          localUserId={session?.userId ?? authUser?.uid ?? ''}
          abandonmentDefeat={connection.abandonmentDefeat}
          reason={events.erroPartida?.motivo}
          onBackToLobby={handleBackToLobby}
        />
      ) : null}

      {events.erroPartida ? <p style={{ color: 'crimson' }}>Erro: {events.erroPartida.motivo}</p> : null}
    </main>
  );
}
