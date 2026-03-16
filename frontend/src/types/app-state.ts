import type {
  ErroPartidaPayload,
  EstadoAtualizadoPayload,
  EstadoPartida,
  FimDeJogoPayload,
  PartidaEncontradaPayload,
  StatusMatchmakingPayload,
} from '../contracts/socket-contracts';

export type FlowStep = 'login' | 'lobby' | 'matchmaking' | 'match-room';

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
};
