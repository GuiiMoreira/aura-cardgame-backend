import type {
  ErroPartidaPayload,
  EstadoAtualizadoPayload,
  EstadoPartida,
  FimDeJogoPayload,
  PartidaEncontradaPayload,
  StatusMatchmakingPayload,
} from '../contracts/socket-contracts';

export type FlowStep =
  | 'login'
  | 'cadastro'
  | 'lobby'
  | 'colecao'
  | 'deckbuilder'
  | 'matchmaking'
  | 'partida'
  | 'resultado';

export type ConnectionState = {
  connected: boolean;
  reconnecting: boolean;
  reconnectAttempts: number;
  reconnectingMessage?: string;
  abandonmentDefeat?: boolean;
};

export type MatchEventsState = {
  matchmakingStatus?: StatusMatchmakingPayload;
  partidaEncontrada?: PartidaEncontradaPayload;
  estadoAtualizado?: EstadoAtualizadoPayload;
  fimDeJogo?: FimDeJogoPayload;
  erroPartida?: ErroPartidaPayload;
};

export type SessionState = {
  token: string;
  userId: string;
  deckId: string;
};

export type MatchState = {
  sala?: string;
  estado?: EstadoPartida;
  attackSelection?: {
    atacanteIds: string[];
    atacanteId?: string;
    alvoId?: string;
  };
};
