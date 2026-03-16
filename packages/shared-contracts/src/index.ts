export type Primitive = string | number | boolean | null;

export type AuraCard = {
  id: string;
  nome?: string;
  forca?: number;
  vida?: number;
  exaustao?: boolean;
  [key: string]: Primitive | Primitive[] | AuraCard[] | Record<string, unknown> | undefined;
};

export type RecursosJogador = {
  C?: number;
  M?: number;
  O?: number;
  A?: number;
};

export type JogadorEstado = {
  vida: number;
  mao?: AuraCard[];
  baralho?: AuraCard[];
  cemiterio?: AuraCard[];
  recursos?: RecursosJogador;
  [key: string]: unknown;
};

export type EstadoPartida = {
  jogadores: Record<string, JogadorEstado>;
  turno: string;
  fase?: string;
  campo?: Record<string, AuraCard[]>;
  [key: string]: unknown;
};

export type ContextoSocket = {
  requestId?: string;
  matchId?: string;
  sala?: string | null;
  userId?: string;
};

export type StatusMatchmakingPayload = ContextoSocket & {
  mensagem: string;
};

export type PartidaEncontradaPayload = ContextoSocket & {
  sala: string;
  estado: EstadoPartida;
};

export type EstadoAtualizadoPayload = ContextoSocket & {
  sala: string;
  estado: EstadoPartida;
};

export type FimDeJogoPayload = ContextoSocket & {
  vencedor: string;
};

export type ErroPartidaPayload = ContextoSocket & {
  motivo: string;
};

export type SocketServerToClientEvents = {
  status_matchmaking: (payload: StatusMatchmakingPayload) => void;
  partida_encontrada: (payload: PartidaEncontradaPayload) => void;
  estado_atualizado: (payload: EstadoAtualizadoPayload) => void;
  fim_de_jogo: (payload: FimDeJogoPayload) => void;
  erro_partida: (payload: ErroPartidaPayload) => void;
};

export type SocketClientToServerEvents = {
  buscar_partida: (payload: { deckId: string | number }) => void;
  passar_turno: (payload: { sala: string }) => void;
  jogar_carta: (payload: { sala: string; cartaId: string }) => void;
  atacar_fortaleza: (payload: { sala: string; atacantesIds: string[] }) => void;
  declarar_ataque: (payload: { sala: string; atacanteId: string; alvoId: string }) => void;
  reconectar_partida: (payload: { sala?: string }) => void;
};
