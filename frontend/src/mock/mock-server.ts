import type {
  EstadoPartida,
  SocketClientToServerEvents,
  SocketServerToClientEvents,
} from '../contracts/socket-contracts';

type Handler<T> = T extends (...args: infer A) => void ? (...args: A) => void : never;

export class MockSocketClient {
  private handlers: Partial<{
    [K in keyof SocketServerToClientEvents]: Handler<SocketServerToClientEvents[K]>[];
  }> = {};

  private listeners: Partial<{
    [K in keyof SocketClientToServerEvents]: Handler<SocketClientToServerEvents[K]>;
  }> = {};

  on<K extends keyof SocketServerToClientEvents>(event: K, cb: Handler<SocketServerToClientEvents[K]>) {
    const current = this.handlers[event] ?? [];
    current.push(cb);
    this.handlers[event] = current;
  }

  emit<K extends keyof SocketClientToServerEvents>(event: K, payload: Parameters<SocketClientToServerEvents[K]>[0]) {
    const listener = this.listeners[event];
    listener?.(payload);
  }

  disconnect() {
    this.handlers = {};
    this.listeners = {};
  }

  bindServer<K extends keyof SocketClientToServerEvents>(
    event: K,
    cb: Handler<SocketClientToServerEvents[K]>
  ) {
    this.listeners[event] = cb;
  }

  serverEmit<K extends keyof SocketServerToClientEvents>(
    event: K,
    payload: Parameters<SocketServerToClientEvents[K]>[0]
  ) {
    const handlers = this.handlers[event] ?? [];
    handlers.forEach((handler) => handler(payload));
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

  socket.bindServer('buscar_partida', () => {
    socket.serverEmit('status_matchmaking', {
      mensagem: 'Mock: buscando oponente visual...',
      requestId: 'mock-1',
      userId,
      sala: null,
      matchId: null,
    });

    setTimeout(() => {
      socket.serverEmit('partida_encontrada', {
        sala,
        matchId: sala,
        requestId: 'mock-2',
        userId,
        estado,
      });
    }, 400);
  });

  socket.bindServer('passar_turno', () => {
    socket.serverEmit('estado_atualizado', {
      sala,
      matchId: sala,
      requestId: 'mock-3',
      userId,
      estado,
    });
  });
}
