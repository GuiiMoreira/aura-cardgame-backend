import { io, type Socket } from 'socket.io-client';
import {
  SOCKET_PROTOCOL_VERSION,
  type SocketClientToServerEvents,
  type SocketServerToClientEvents,
} from '../contracts/socket-contracts';

type GenericHandler = (...args: any[]) => void;

type SocketTransport = {
  on: (event: string, cb: GenericHandler) => void;
  emit: (event: string, payload?: unknown) => void;
  disconnect: () => void;
};

export type AuraSocket = Socket<SocketServerToClientEvents, SocketClientToServerEvents>;

export type SocketClientOptions = {
  url: string;
  token: string;
  protocolVersion?: string;
};

export type MatchEventHandlers = {
  onStatusMatchmaking: SocketServerToClientEvents['status_matchmaking'];
  onPartidaEncontrada: SocketServerToClientEvents['partida_encontrada'];
  onEstadoAtualizado: SocketServerToClientEvents['estado_atualizado'];
  onFimDeJogo: SocketServerToClientEvents['fim_de_jogo'];
  onErroPartida: SocketServerToClientEvents['erro_partida'];
  onConnected: () => void;
  onDisconnected: (reason: string) => void;
  onReconnectAttempt: (attempt: number) => void;
  onReconnectSuccess: () => void;
  onReconnectFailed: () => void;
};

export function createSocketClient({
  url,
  token,
  protocolVersion = SOCKET_PROTOCOL_VERSION,
}: SocketClientOptions): AuraSocket {
  return io(url, {
    auth: { token, protocolVersion },
    transports: ['websocket'],
  });
}

export class SocketClientService {
  private readonly transport: SocketTransport;

  constructor(transport: SocketTransport) {
    this.transport = transport;
  }

  subscribe(handlers: MatchEventHandlers) {
    this.transport.on('connect', handlers.onConnected);
    this.transport.on('disconnect', handlers.onDisconnected);
    this.transport.on('reconnect_attempt', handlers.onReconnectAttempt);
    this.transport.on('reconnect', handlers.onReconnectSuccess);
    this.transport.on('reconnect_failed', handlers.onReconnectFailed);

    this.transport.on('status_matchmaking', handlers.onStatusMatchmaking);
    this.transport.on('partida_encontrada', handlers.onPartidaEncontrada);
    this.transport.on('estado_atualizado', handlers.onEstadoAtualizado);
    this.transport.on('fim_de_jogo', handlers.onFimDeJogo);
    this.transport.on('erro_partida', handlers.onErroPartida);
  }

  buscarPartida(deckId: string) {
    this.transport.emit('buscar_partida', { deckId });
  }

  passarTurno(sala: string) {
    this.transport.emit('passar_turno', { sala });
  }

  jogarCarta(sala: string, cartaId: string) {
    this.transport.emit('jogar_carta', { sala, cartaId });
  }

  atacarFortaleza(sala: string, atacantesIds: string[]) {
    this.transport.emit('atacar_fortaleza', { sala, atacantesIds });
  }

  declararAtaque(sala: string, atacanteId: string, alvoId: string) {
    this.transport.emit('declarar_ataque', { sala, atacanteId, alvoId });
  }

  reconectarPartida(sala?: string) {
    this.transport.emit('reconectar_partida', { sala });
  }

  disconnect() {
    this.transport.disconnect();
  }
}
