import {
  SOCKET_PROTOCOL_VERSION,
  type EstadoPartida,
  type SocketClientToServerEvents,
  type SocketServerToClientEvents,
} from '../contracts/socket-contracts';

type Handler<T> = T extends (...args: infer A) => void ? (...args: A) => void : never;
type InternalEvents = 'connect' | 'disconnect' | 'reconnect_attempt' | 'reconnect' | 'reconnect_failed';

export class MockSocketClient {
  private handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  private internalHandlers: Partial<Record<InternalEvents, ((...args: unknown[]) => void)[]>> = {};
  private listeners: Partial<{
    [K in keyof SocketClientToServerEvents]: Handler<SocketClientToServerEvents[K]>;
  }> = {};

  on<K extends keyof SocketServerToClientEvents>(event: K, cb: Handler<SocketServerToClientEvents[K]>): void;
  on(event: InternalEvents, cb: (...args: unknown[]) => void): void;
  on(event: string, cb: (...args: unknown[]) => void) {
    const isInternalEvent = ['connect', 'disconnect', 'reconnect_attempt', 'reconnect', 'reconnect_failed'].includes(event);
    if (isInternalEvent) {
      const internalEvent = event as InternalEvents;
      const current = this.internalHandlers[internalEvent] ?? [];
      current.push(cb);
      this.internalHandlers[internalEvent] = current;
      return;
    }

    const current = this.handlers[event] ?? [];
    current.push(cb);
    this.handlers[event] = current;
  }

  emit<K extends keyof SocketClientToServerEvents>(event: K, payload: Parameters<SocketClientToServerEvents[K]>[0]) {
    const listener = this.listeners[event] as ((data: unknown) => void) | undefined;
    listener?.(payload);
  }

  disconnect() {
    this.internalEmit('disconnect', 'manual_disconnect');
    this.handlers = {};
    this.listeners = {};
  }

  bindServer<K extends keyof SocketClientToServerEvents>(event: K, cb: Handler<SocketClientToServerEvents[K]>) {
    this.listeners[event] = cb;
  }

  serverEmit<K extends keyof SocketServerToClientEvents>(event: K, payload: Parameters<SocketServerToClientEvents[K]>[0]) {
    const handlers = this.handlers[event] ?? [];
    handlers.forEach((handler) => handler(payload));
  }

  internalEmit(event: InternalEvents, ...args: unknown[]) {
    const handlers = this.internalHandlers[event] ?? [];
    handlers.forEach((handler) => handler(...args));
  }
}

function createMockEstado(userId: string): EstadoPartida {
  const enemyId = 'bot_treino';
  return {
    turno: userId,
    fase: 'Manifestação',
    jogadores: {
      [userId]: { vida: 20, mao: [{ id: 'carta_mock_1', nome: 'Sentinela de Aura', forca: 3, vida: 2 }] },
      [enemyId]: { vida: 20, mao: [{ id: 'carta_mock_2', nome: 'Eco Prismático', forca: 2, vida: 3 }] },
    },
    campo: { [userId]: [], [enemyId]: [] },
  };
}

export function startMockServer(socket: MockSocketClient, userId: string) {
  const sala = `mock_${userId}`;
  const estado = createMockEstado(userId);

  setTimeout(() => socket.internalEmit('connect'), 50);

  socket.bindServer('buscar_partida', () => {
    socket.serverEmit('status_matchmaking', {
      protocolVersion: SOCKET_PROTOCOL_VERSION,
      mensagem: 'Mock: buscando oponente visual...',
      requestId: 'mock-1',
      userId,
      sala: undefined,
      matchId: undefined,
    });

    setTimeout(() => {
      socket.serverEmit('partida_encontrada', {
        protocolVersion: SOCKET_PROTOCOL_VERSION,
        sala,
        matchId: sala,
        requestId: 'mock-2',
        userId,
        estado,
      });
    }, 500);
  });

  socket.bindServer('passar_turno', () => {
    estado.turno = estado.turno === userId ? 'bot_treino' : userId;
    socket.serverEmit('estado_atualizado', {
      protocolVersion: SOCKET_PROTOCOL_VERSION,
      sala,
      matchId: sala,
      requestId: 'mock-3',
      userId,
      estado,
    });
  });

  socket.bindServer('reconectar_partida', () => {
    socket.internalEmit('reconnect_attempt', 1);
    setTimeout(() => {
      socket.internalEmit('reconnect', 1);
      socket.serverEmit('estado_atualizado', {
        protocolVersion: SOCKET_PROTOCOL_VERSION,
        sala,
        matchId: sala,
        requestId: 'mock-4',
        userId,
        estado,
      });
    }, 900);
  });

  setTimeout(() => {
    socket.serverEmit('erro_partida', {
      protocolVersion: SOCKET_PROTOCOL_VERSION,
      motivo: 'Conexão instável detectada. Derrota por abandono se não reconectar.',
      requestId: 'mock-5',
      userId,
      sala,
      matchId: sala,
    });
    socket.internalEmit('disconnect', 'transport close');
  }, 7000);
}
