const { criarEstadoInicialDoJogo } = require('../game/logic');
const {
  passarTurno,
  jogarCarta,
  atacarFortaleza,
  declararAtaque,
  ativarHabilidadeDaCarta,
} = require('../game/actions');
const { InvalidPhaseActionError } = require('../game/turn-phases');
const { createRequestId, logger: baseLogger } = require('../logger');

const CURRENT_PROTOCOL_VERSION = '1.1.0';

function withProtocol(payload = {}) {
  return { protocolVersion: CURRENT_PROTOCOL_VERSION, ...payload };
}

const jogosAtivos = {};
const salaAtivaPorUid = {};
const conexoesPorSala = {};
let filaDeEspera = null;
const TEMPO_LIMITE_RECONEXAO_MS = 60 * 1000;
const TTL_PARTIDA_ABANDONADA_MS = 24 * 60 * 60 * 1000;
const STATUS_RECUPERAVEIS_STARTUP = ['ativa', 'recuperavel', 'pausada', 'pendente'];

function construirEstadoSimplificado(estado = {}) {
  const jogadores = Object.fromEntries(
    Object.entries(estado.jogadores || {}).map(([uid, jogador]) => [
      uid,
      {
        vida: jogador?.vida ?? 0,
        recursos: jogador?.recursos || {},
        recursosMax: jogador?.recursosMax || {},
        geracaoRecursos: jogador?.geracaoRecursos || {},
        mao: (jogador?.mao || []).map((carta) => carta?.id).filter(Boolean),
        baralhoRestante: Array.isArray(jogador?.baralho) ? jogador.baralho.length : 0,
        cemiterio: (jogador?.cemiterio || []).map((carta) => carta?.id).filter(Boolean),
      },
    ])
  );

  const campo = Object.fromEntries(
    Object.entries(estado.campo || {}).map(([uid, cartas]) => [
      uid,
      (cartas || []).map((carta) => ({
        id: carta?.id || null,
        forca: carta?.Força ?? 0,
        vida: carta?.Vida ?? 0,
        exaustao: Boolean(carta?.exaustao),
      })),
    ])
  );

  return {
    turno: estado.turno || null,
    fase: estado.fase || null,
    jogadores,
    campo,
  };
}

const metrics = {
  conexoesAtivas: 0,
  matchmakingPendente: 0,
  partidasAtivas: 0,
  latenciaPorEvento: {},
};

function updateQueueMetric() {
  metrics.matchmakingPendente = filaDeEspera ? 1 : 0;
}

function updateActiveMatchesMetric() {
  metrics.partidasAtivas = Object.keys(jogosAtivos).length;
}

function registrarLatenciaEvento(evento, startedAt) {
  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  const atual = metrics.latenciaPorEvento[evento] || {
    totalMs: 0,
    count: 0,
    maxMs: 0,
    lastMs: 0,
    avgMs: 0,
  };

  atual.count += 1;
  atual.totalMs += durationMs;
  atual.lastMs = Number(durationMs.toFixed(2));
  atual.maxMs = Math.max(atual.maxMs, atual.lastMs);
  atual.avgMs = Number((atual.totalMs / atual.count).toFixed(2));

  metrics.latenciaPorEvento[evento] = atual;
}

function getMetrics() {
  return {
    conexoesAtivas: metrics.conexoesAtivas,
    matchmakingPendente: metrics.matchmakingPendente,
    partidasAtivas: metrics.partidasAtivas,
    latenciaPorEvento: metrics.latenciaPorEvento,
  };
}

function emitirErroPartida(socket, motivo, context = {}, logger = baseLogger) {
  socket.emit('erro_partida', withProtocol({ motivo, ...context }));
  logger.warn('Evento erro_partida emitido.', context);
}

function emitirErroAutenticacao(socket, motivo, context = {}, logger = baseLogger) {
  emitirErroPartida(socket, motivo, context, logger);
  socket.disconnect(true);
}

function payloadInvalido(socket, mensagem, context = {}, logger = baseLogger) {
  emitirErroPartida(socket, mensagem, context, logger);
}

function getSocketUid(socket) {
  return socket.user?.uid || null;
}

function mapearJogadorAutenticadoParaSocketAtivo(socket) {
  const userId = getSocketUid(socket);
  if (!userId) return null;

  const sala = salaAtivaPorUid[userId]?.sala || null;
  if (!sala) return null;

  atualizarSocketDaSalaAtiva(userId, socket.id);
  socket.data = { ...(socket.data || {}), salaAtiva: sala };
  return sala;
}

function limparTimerReconexao(metaJogador) {
  if (metaJogador?.timerReconexao) {
    clearTimeout(metaJogador.timerReconexao);
    metaJogador.timerReconexao = null;
  }
}

function garantirConexaoDaSala(sala) {
  if (!sala) return null;
  if (!conexoesPorSala[sala]) {
    conexoesPorSala[sala] = {};
  }

  return conexoesPorSala[sala];
}

function definirJogadorNaSala(sala, uid, dados = {}) {
  if (!sala || !uid) return null;

  const conexoesDaSala = garantirConexaoDaSala(sala);
  const atual = conexoesDaSala[uid] || { socketId: null, conectado: false, timerReconexao: null };
  conexoesDaSala[uid] = {
    ...atual,
    ...dados,
  };

  return conexoesDaSala[uid];
}

function limparConexoesDaSala(sala) {
  const conexoesDaSala = conexoesPorSala[sala];
  if (!conexoesDaSala) return;

  Object.values(conexoesDaSala).forEach((metaJogador) => limparTimerReconexao(metaJogador));
  delete conexoesPorSala[sala];
}

function calcularExpiracaoTTL() {
  return new Date(Date.now() + TTL_PARTIDA_ABANDONADA_MS);
}

function montarSnapshotPartida(sala, jogo, extras = {}) {
  const conexoesDaSala = conexoesPorSala[sala] || jogo.jogadores || {};

  return {
    sala,
    estado: construirEstadoSimplificado(jogo.estado),
    estadoCompleto: jogo.estado,
    jogadores: Object.fromEntries(
      Object.entries(conexoesDaSala).map(([uid, jogador]) => [
        uid,
        {
          conectado: Boolean(jogador?.conectado),
          socketId: jogador?.socketId || null,
        },
      ])
    ),
    updatedAt: new Date(),
    expiresAt: calcularExpiracaoTTL(),
    status: extras.status || 'ativa',
    recuperavel: extras.recuperavel ?? true,
    ...extras,
  };
}

async function persistirPartidaAtiva(db, sala, jogo, extras = {}) {
  await db
    .collection('partidas_ativas')
    .doc(sala)
    .set(montarSnapshotPartida(sala, jogo, extras), { merge: true });
}

async function moverPartidaParaHistorico(db, sala, jogo, payloadFinal = {}) {
  const snapshotFinal = montarSnapshotPartida(sala, jogo, {
    status: 'finalizada',
    recuperavel: false,
    fim: payloadFinal,
    finalizadaEm: new Date(),
    expiresAt: null,
  });

  await db.collection('partidas_historico').doc(sala).set(snapshotFinal);
  await db.collection('partidas_ativas').doc(sala).delete();
}

async function encerrarPartida(io, db, sala, payload, logger = baseLogger) {
  const jogo = jogosAtivos[sala];
  if (!jogo) return;

  const conexoesDaSala = conexoesPorSala[sala] || jogo.jogadores || {};
  Object.values(conexoesDaSala).forEach((metaJogador) => limparTimerReconexao(metaJogador));
  Object.keys(conexoesDaSala).forEach((uid) => limparSalaAtivaDoJogador(uid, sala));

  try {
    await moverPartidaParaHistorico(db, sala, jogo, payload);
  } catch (error) {
    logger.error('Falha ao mover partida para histórico.', { sala, matchId: sala, error });
  }

  io.to(sala).emit('fim_de_jogo', withProtocol({ ...payload, sala, matchId: sala }));
  delete jogosAtivos[sala];
  limparConexoesDaSala(sala);
  updateActiveMatchesMetric();
  logger.info('Partida encerrada.', { sala, matchId: sala, payload });
}

function buscarJogoPorSocketId(socketId) {
  return Object.entries(jogosAtivos).find(([sala, jogo]) => {
    const conexoesDaSala = conexoesPorSala[sala] || jogo.jogadores || {};
    return Object.values(conexoesDaSala).some((metaJogador) => metaJogador.socketId === socketId);
  });
}

function registrarSalaAtivaDoJogador(uid, sala, socketId = null) {
  if (!uid || !sala) return;
  salaAtivaPorUid[uid] = { sala, socketId };
}

function atualizarSocketDaSalaAtiva(uid, socketId) {
  if (!uid || !salaAtivaPorUid[uid]) return;
  salaAtivaPorUid[uid].socketId = socketId || null;
}

function limparSalaAtivaDoJogador(uid, salaEsperada = null) {
  if (!uid || !salaAtivaPorUid[uid]) return;
  if (salaEsperada && salaAtivaPorUid[uid].sala !== salaEsperada) return;
  delete salaAtivaPorUid[uid];
}

function buscarJogoPorUid(userId) {
  const sala = salaAtivaPorUid[userId]?.sala;
  if (!sala) return null;

  const jogo = jogosAtivos[sala];
  if (!jogo) {
    limparSalaAtivaDoJogador(userId, sala);
    return null;
  }

  return [sala, jogo];
}

async function carregarPartidasRecuperaveis(db, logger = baseLogger) {
  const snapshot = await db
    .collection('partidas_ativas')
    .where('status', 'in', STATUS_RECUPERAVEIS_STARTUP)
    .get();

  if (snapshot.empty) {
    logger.info('Nenhuma partida ativa para recuperar no startup.');
    return 0;
  }

  const agora = new Date();
  const expiradas = [];
  const salasValidas = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    const sala = data.sala || doc.id;
    const estado = data.estadoCompleto || data.estado;

    if (data?.expiresAt instanceof Date && data.expiresAt <= agora) {
      expiradas.push(doc.ref);
      logger.info('Partida ativa expirada ignorada durante recuperação.', {
        sala,
        matchId: sala,
      });
      return;
    }

    if (!sala || !estado?.jogadores) {
      logger.warn('Documento inválido em partidas_ativas, ignorando recuperação.', {
        sala: doc.id,
        matchId: doc.id,
      });
      return;
    }

    const jogadores = Object.keys(estado.jogadores).reduce((acc, uid) => {
      acc[uid] = { socketId: null, conectado: false, timerReconexao: null };
      definirJogadorNaSala(sala, uid, { socketId: null, conectado: false, timerReconexao: null });
      registrarSalaAtivaDoJogador(uid, sala, null);
      return acc;
    }, {});

    jogosAtivos[sala] = { estado, jogadores };
    salasValidas.push({ sala, doc });
  });

  const batch = db.batch();
  expiradas.forEach((ref) => {
    batch.delete(ref);
  });

  salasValidas.forEach(({ doc }) => {
    const data = doc.data() || {};
    const estado = data.estadoCompleto || data.estado || {};
    batch.set(
      doc.ref,
      {
        status: 'recuperavel',
        recuperavel: true,
        jogadores: Object.fromEntries(
          Object.keys(estado.jogadores || {}).map((uid) => [
            uid,
            { conectado: false, socketId: null },
          ])
        ),
        updatedAt: new Date(),
        expiresAt: calcularExpiracaoTTL(),
      },
      { merge: true }
    );
  });
  await batch.commit();

  updateActiveMatchesMetric();
  logger.info('Partidas recuperáveis carregadas no startup.', {
    quantidade: snapshot.size,
    partidasAtivas: metrics.partidasAtivas,
  });
  return snapshot.size;
}

async function limparPartidasAbandonadas(db, logger = baseLogger) {
  const agora = new Date();
  const snapshot = await db.collection('partidas_ativas').where('expiresAt', '<=', agora).get();

  if (snapshot.empty) return 0;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const sala = data?.sala || doc.id;
    Object.keys(data?.estadoCompleto?.jogadores || data?.estado?.jogadores || {}).forEach((uid) => {
      limparSalaAtivaDoJogador(uid, sala);
    });
    delete jogosAtivos[sala];
    limparConexoesDaSala(sala);
    batch.delete(doc.ref);
  });
  await batch.commit();
  updateActiveMatchesMetric();

  logger.info('Partidas abandonadas removidas por TTL.', { quantidade: snapshot.size });
  return snapshot.size;
}

function iniciarLimpezaPeriodica(db, logger = baseLogger) {
  const intervaloMs = 15 * 60 * 1000;
  const timer = setInterval(async () => {
    try {
      await limparPartidasAbandonadas(db, logger);
    } catch (error) {
      logger.error('Falha na limpeza periódica de partidas abandonadas.', { error });
    }
  }, intervaloMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

function gerenciarSockets(io, db, logger = baseLogger) {
  io.on('connection', (socket) => {
    metrics.conexoesAtivas += 1;

    if (!socket.user) {
      const motivo = socket.authError || 'Falha na autenticação do socket.';
      const requestId = socket.requestId || createRequestId();
      emitirErroAutenticacao(socket, motivo, { requestId, userId: null }, logger);
      metrics.conexoesAtivas -= 1;
      return;
    }

    const socketUid = getSocketUid(socket);
    const connectionRequestId = socket.requestId || createRequestId();
    logger.info('Jogador autenticado conectado.', {
      requestId: connectionRequestId,
      socketId: socket.id,
      userId: socketUid,
      conexoesAtivas: metrics.conexoesAtivas,
    });

    const salaAtivaMapeada = mapearJogadorAutenticadoParaSocketAtivo(socket);
    if (salaAtivaMapeada) {
      logger.info('Socket autenticado mapeado para sala ativa do jogador.', {
        requestId: connectionRequestId,
        userId: socketUid,
        socketId: socket.id,
        sala: salaAtivaMapeada,
        matchId: salaAtivaMapeada,
      });
    }

    socket.on('buscar_partida', async ({ deckId } = {}) => {
      const startedAt = process.hrtime.bigint();
      const requestId = createRequestId();
      const userId = getSocketUid(socket);
      const contexto = { requestId, userId, sala: null, matchId: null };

      try {
        if (!userId) {
          emitirErroAutenticacao(socket, 'Socket não autenticado.', contexto, logger);
          return;
        }

        if (!deckId) {
          payloadInvalido(socket, 'deckId é obrigatório para buscar_partida.', contexto, logger);
          return;
        }

        if (filaDeEspera && filaDeEspera.userId === userId) {
          logger.warn('Jogador já está na fila, requisição ignorada.', contexto);
          return;
        }

        logger.info('Busca de partida recebida.', { ...contexto, deckId });

        if (!filaDeEspera) {
          filaDeEspera = { socket, deckId, userId };
          updateQueueMetric();
          socket.emit(
            'status_matchmaking',
            withProtocol({
              mensagem: 'Você está na fila, aguardando outro jogador...',
              requestId,
              userId,
              sala: null,
              matchId: null,
            })
          );
          logger.info('Jogador inserido na fila de matchmaking.', {
            ...contexto,
            matchmakingPendente: metrics.matchmakingPendente,
          });
          return;
        }

        const { socket: j1Socket, deckId: d1, userId: u1 } = filaDeEspera;
        const { socket: j2Socket, deckId: d2, userId: u2 } = { socket, deckId, userId };
        filaDeEspera = null;
        updateQueueMetric();

        const nomeDaSala = `sala_${j1Socket.id}_${j2Socket.id}`;
        const contextoMatch = { requestId, sala: nomeDaSala, matchId: nomeDaSala, userId };
        j1Socket.join(nomeDaSala);
        j2Socket.join(nomeDaSala);

        logger.info('Matchmaking concluído.', {
          ...contextoMatch,
          jogadores: [
            { userId: u1, deckId: d1 },
            { userId: u2, deckId: d2 },
          ],
        });

        try {
          const estadoInicial = await criarEstadoInicialDoJogo(db, u1, d1, u2, d2);
          jogosAtivos[nomeDaSala] = {
            estado: estadoInicial,
            jogadores: {
              [u1]: { socketId: j1Socket.id, conectado: true, timerReconexao: null },
              [u2]: { socketId: j2Socket.id, conectado: true, timerReconexao: null },
            },
          };
          definirJogadorNaSala(nomeDaSala, u1, {
            socketId: j1Socket.id,
            conectado: true,
            timerReconexao: null,
          });
          definirJogadorNaSala(nomeDaSala, u2, {
            socketId: j2Socket.id,
            conectado: true,
            timerReconexao: null,
          });
          registrarSalaAtivaDoJogador(u1, nomeDaSala, j1Socket.id);
          registrarSalaAtivaDoJogador(u2, nomeDaSala, j2Socket.id);
          updateActiveMatchesMetric();
          await persistirPartidaAtiva(db, nomeDaSala, jogosAtivos[nomeDaSala], {
            status: 'ativa',
            recuperavel: true,
          });
          io.to(nomeDaSala).emit(
            'partida_encontrada',
            withProtocol({
              sala: nomeDaSala,
              matchId: nomeDaSala,
              requestId,
              estado: estadoInicial,
            })
          );
          logger.info('Partida criada com sucesso.', {
            ...contextoMatch,
            partidasAtivas: metrics.partidasAtivas,
          });
        } catch (error) {
          const motivo =
            error?.code === 'DECK_INVALIDO'
              ? error.message
              : 'Não foi possível carregar os baralhos.';
          logger.error('Erro ao criar estado inicial da partida.', {
            ...contextoMatch,
            jogadores: [
              { userId: u1, deckId: d1 },
              { userId: u2, deckId: d2 },
            ],
            error,
          });
          io.to(nomeDaSala).emit(
            'erro_partida',
            withProtocol({
              motivo,
              codigo: error?.code || 'PARTIDA_INDISPONIVEL',
              requestId,
              sala: nomeDaSala,
              matchId: nomeDaSala,
              userId,
            })
          );
        }
      } finally {
        registrarLatenciaEvento('buscar_partida', startedAt);
      }
    });

    const criarManipuladorDeAcao = (nomeAcao, logicaAcao) => {
      socket.on(nomeAcao, async (payload = {}) => {
        const startedAt = process.hrtime.bigint();
        const requestId = createRequestId();
        let sala = null;
        const userId = getSocketUid(socket);

        try {
          if (!payload || typeof payload !== 'object' || typeof payload.sala !== 'string') {
            payloadInvalido(
              socket,
              `Payload inválido para ${nomeAcao}.`,
              { requestId, userId, sala, matchId: sala },
              logger
            );
            return;
          }

          sala = payload.sala;
          const jogo = jogosAtivos[sala];
          if (!jogo) return;

          const jogador = conexoesPorSala[sala]?.[userId] || jogo.jogadores?.[userId];
          if (
            !userId ||
            !jogador ||
            jogador.socketId !== socket.id ||
            !jogador.conectado ||
            userId !== jogo.estado.turno
          )
            return;

          let acaoValida;
          try {
            acaoValida = logicaAcao(jogo.estado, userId, payload);
          } catch (error) {
            if (error instanceof InvalidPhaseActionError) {
              emitirErroPartida(
                socket,
                error.message,
                {
                  requestId,
                  userId,
                  sala,
                  matchId: sala,
                  codigo: error.code,
                  acao: error.actionName,
                  faseAtual: error.faseAtual,
                  fasesPermitidas: error.fasesPermitidas,
                },
                logger
              );
              return;
            }

            throw error;
          }
          if (acaoValida === false) return;

          await persistirPartidaAtiva(db, sala, jogo, { status: 'ativa', recuperavel: true });

          const oponenteId = Object.keys(jogo.estado.jogadores).find((id) => id !== userId);
          if (jogo.estado.jogadores[oponenteId].vida <= 0) {
            await encerrarPartida(io, db, sala, { vencedor: userId, requestId }, logger);
          } else {
            io.to(sala).emit(
              'estado_atualizado',
              withProtocol({
                sala,
                matchId: sala,
                requestId,
                estado: jogo.estado,
              })
            );
          }

          logger.info('Evento de ação processado.', {
            requestId,
            userId,
            sala,
            matchId: sala,
            evento: nomeAcao,
          });
        } finally {
          registrarLatenciaEvento(nomeAcao, startedAt);
        }
      });
    };

    socket.on('reconectar_partida', async ({ sala } = {}) => {
      const startedAt = process.hrtime.bigint();
      const requestId = createRequestId();
      const userId = getSocketUid(socket);

      try {
        const salaAlvo = typeof sala === 'string' ? sala : salaAtivaPorUid[userId]?.sala;
        if (!salaAlvo) {
          payloadInvalido(
            socket,
            'Payload inválido para reconectar_partida.',
            { requestId, userId, sala: null, matchId: null },
            logger
          );
          return;
        }

        const jogo = jogosAtivos[salaAlvo];
        if (!jogo) {
          emitirErroPartida(
            socket,
            'Partida não encontrada para reconexão.',
            { requestId, userId, sala: salaAlvo, matchId: salaAlvo },
            logger
          );
          return;
        }

        if (!userId) {
          emitirErroAutenticacao(
            socket,
            'Socket não autenticado para reconexão.',
            { requestId, userId, sala: salaAlvo, matchId: salaAlvo },
            logger
          );
          return;
        }

        const jogador = jogo.jogadores?.[userId];
        if (!jogador) {
          emitirErroPartida(
            socket,
            'Jogador não pertence a esta partida.',
            { requestId, userId, sala: salaAlvo, matchId: salaAlvo },
            logger
          );
          return;
        }

        limparTimerReconexao(jogador);
        jogador.socketId = socket.id;
        jogador.conectado = true;
        definirJogadorNaSala(salaAlvo, userId, {
          socketId: socket.id,
          conectado: true,
          timerReconexao: jogador.timerReconexao,
        });
        registrarSalaAtivaDoJogador(userId, salaAlvo, socket.id);
        socket.join(salaAlvo);

        await persistirPartidaAtiva(db, salaAlvo, jogo, { status: 'ativa', recuperavel: true });
        io.to(salaAlvo).emit(
          'estado_atualizado',
          withProtocol({
            sala: salaAlvo,
            matchId: salaAlvo,
            requestId,
            estado: jogo.estado,
          })
        );
        logger.info('Jogador reconectado na partida.', {
          requestId,
          userId,
          sala: salaAlvo,
          matchId: salaAlvo,
          socketId: socket.id,
        });
      } finally {
        registrarLatenciaEvento('reconectar_partida', startedAt);
      }
    });

    criarManipuladorDeAcao('passar_turno', (estado, userId) => {
      passarTurno(estado, userId);
    });

    criarManipuladorDeAcao('jogar_carta', (estado, userId, payload = {}) => {
      const { cartaId, sacrificeAllyId, sacrificeAllyIds } = payload;

      if (typeof cartaId !== 'string') {
        payloadInvalido(
          socket,
          'cartaId inválido para jogar_carta.',
          { requestId: createRequestId(), userId, sala: null, matchId: null },
          logger
        );
        return false;
      }

      if (
        typeof sacrificeAllyId !== 'undefined' &&
        typeof sacrificeAllyId !== 'string'
      ) {
        payloadInvalido(
          socket,
          'sacrificeAllyId inválido para jogar_carta.',
          { requestId: createRequestId(), userId, sala: null, matchId: null },
          logger
        );
        return false;
      }

      if (
        typeof sacrificeAllyIds !== 'undefined' &&
        (!Array.isArray(sacrificeAllyIds) || sacrificeAllyIds.some((id) => typeof id !== 'string'))
      ) {
        payloadInvalido(
          socket,
          'sacrificeAllyIds inválido para jogar_carta.',
          { requestId: createRequestId(), userId, sala: null, matchId: null },
          logger
        );
        return false;
      }

      jogarCarta(estado, userId, cartaId, { sacrificeAllyId, sacrificeAllyIds });
      return true;
    });

    criarManipuladorDeAcao('atacar_fortaleza', (estado, userId, { atacantesIds }) => {
      if (!Array.isArray(atacantesIds)) {
        payloadInvalido(
          socket,
          'atacantesIds inválido para atacar_fortaleza.',
          { requestId: createRequestId(), userId, sala: null, matchId: null },
          logger
        );
        return false;
      }
      atacarFortaleza(estado, userId, atacantesIds);
      return true;
    });

    criarManipuladorDeAcao('declarar_ataque', (estado, userId, { atacanteId, alvoId }) => {
      if (typeof atacanteId !== 'string' || typeof alvoId !== 'string') {
        payloadInvalido(
          socket,
          'atacanteId/alvoId inválido para declarar_ataque.',
          { requestId: createRequestId(), userId, sala: null, matchId: null },
          logger
        );
        return false;
      }
      declararAtaque(estado, userId, atacanteId, alvoId);
      return true;
    });

    criarManipuladorDeAcao(
      'ativar_habilidade_carta',
      (estado, userId, { cartaId, habilidadeTipo }) => {
        if (typeof cartaId !== 'string' || typeof habilidadeTipo !== 'string') {
          payloadInvalido(
            socket,
            'cartaId/habilidadeTipo inválido para ativar_habilidade_carta.',
            { requestId: createRequestId(), userId, sala: null, matchId: null },
            logger
          );
          return false;
        }

        ativarHabilidadeDaCarta(estado, userId, cartaId, habilidadeTipo);
        return true;
      }
    );

    socket.on('disconnect', () => {
      const requestId = createRequestId();
      metrics.conexoesAtivas = Math.max(metrics.conexoesAtivas - 1, 0);
      logger.info('Jogador desconectado do socket.', {
        requestId,
        socketId: socket.id,
        conexoesAtivas: metrics.conexoesAtivas,
      });

      if (filaDeEspera && filaDeEspera.socket.id === socket.id) {
        logger.info('Jogador removido da fila após desconexão.', {
          requestId,
          userId: filaDeEspera.userId,
          sala: null,
          matchId: null,
        });
        filaDeEspera = null;
        updateQueueMetric();
      }

      const userId = getSocketUid(socket);
      const jogoEncontrado = userId ? buscarJogoPorUid(userId) : buscarJogoPorSocketId(socket.id);
      if (!jogoEncontrado) return;

      const [sala, jogo] = jogoEncontrado;
      const jogador = userId ? conexoesPorSala[sala]?.[userId] || jogo.jogadores?.[userId] : null;
      if (!jogador || jogador.socketId !== socket.id) return;

      jogador.conectado = false;
      jogador.socketId = null;
      atualizarSocketDaSalaAtiva(userId, null);
      limparTimerReconexao(jogador);
      jogador.timerReconexao = setTimeout(async () => {
        const jogoAtual = jogosAtivos[sala];
        const jogadorAtual = conexoesPorSala[sala]?.[userId] || jogoAtual?.jogadores?.[userId];
        if (!jogadorAtual || jogadorAtual.conectado) return;

        const oponenteId = Object.keys(jogoAtual.estado.jogadores).find((id) => id !== userId);
        const payloadFim = {
          motivo: 'abandono/desconexao',
          jogadorDesconectado: userId,
          requestId,
        };
        if (oponenteId) payloadFim.vencedor = oponenteId;
        await encerrarPartida(io, db, sala, payloadFim, logger);
      }, TEMPO_LIMITE_RECONEXAO_MS);

      persistirPartidaAtiva(db, sala, jogo, { status: 'recuperavel', recuperavel: true }).catch(
        (error) => {
          logger.error('Falha ao atualizar status de reconexão da sala.', {
            requestId,
            sala,
            matchId: sala,
            userId,
            error,
          });
        }
      );

      logger.info('Jogador desconectado da sala, aguardando reconexão.', {
        requestId,
        userId,
        sala,
        matchId: sala,
        timeoutSegundos: TEMPO_LIMITE_RECONEXAO_MS / 1000,
      });
    });
  });
}

gerenciarSockets.carregarPartidasRecuperaveis = carregarPartidasRecuperaveis;
gerenciarSockets.limparPartidasAbandonadas = limparPartidasAbandonadas;
gerenciarSockets.iniciarLimpezaPeriodica = iniciarLimpezaPeriodica;
gerenciarSockets.getMetrics = getMetrics;
gerenciarSockets.__testables = {
  construirEstadoSimplificado,
  limparPartidasAbandonadas,
};

module.exports = gerenciarSockets;
