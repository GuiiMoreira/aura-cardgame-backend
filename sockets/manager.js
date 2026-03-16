const { criarEstadoInicialDoJogo } = require('../game/logic');
const { passarTurno, jogarCarta, atacarFortaleza, declararAtaque } = require('../game/actions');
const { createRequestId, logger: baseLogger } = require('../logger');

const jogosAtivos = {};
let filaDeEspera = null;
const TEMPO_LIMITE_RECONEXAO_MS = 60 * 1000;
const TTL_PARTIDA_ABANDONADA_MS = 24 * 60 * 60 * 1000;

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
  socket.emit('erro_partida', { motivo, ...context });
  logger.warn('Evento erro_partida emitido.', context);
}

function payloadInvalido(socket, mensagem, context = {}, logger = baseLogger) {
  emitirErroPartida(socket, mensagem, context, logger);
}

function getSocketUid(socket) {
  return socket.user?.uid || null;
}

function limparTimerReconexao(metaJogador) {
  if (metaJogador?.timerReconexao) {
    clearTimeout(metaJogador.timerReconexao);
    metaJogador.timerReconexao = null;
  }
}

function calcularExpiracaoTTL() {
  return new Date(Date.now() + TTL_PARTIDA_ABANDONADA_MS);
}

function montarSnapshotPartida(sala, jogo, extras = {}) {
  return {
    sala,
    estado: jogo.estado,
    jogadores: Object.fromEntries(
      Object.entries(jogo.jogadores || {}).map(([uid, jogador]) => [
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

  Object.values(jogo.jogadores || {}).forEach((metaJogador) => limparTimerReconexao(metaJogador));

  try {
    await moverPartidaParaHistorico(db, sala, jogo, payload);
  } catch (error) {
    logger.error('Falha ao mover partida para histórico.', { sala, matchId: sala, error });
  }

  io.to(sala).emit('fim_de_jogo', { ...payload, sala, matchId: sala });
  delete jogosAtivos[sala];
  updateActiveMatchesMetric();
  logger.info('Partida encerrada.', { sala, matchId: sala, payload });
}

function buscarJogoPorSocketId(socketId) {
  return Object.entries(jogosAtivos).find(([, jogo]) => {
    return Object.values(jogo.jogadores || {}).some(
      (metaJogador) => metaJogador.socketId === socketId
    );
  });
}

async function carregarPartidasRecuperaveis(db, logger = baseLogger) {
  const snapshot = await db
    .collection('partidas_ativas')
    .where('status', 'in', ['ativa', 'recuperavel'])
    .get();

  if (snapshot.empty) {
    logger.info('Nenhuma partida ativa para recuperar no startup.');
    return 0;
  }

  snapshot.forEach((doc) => {
    const data = doc.data();
    const sala = data.sala || doc.id;
    const estado = data.estado;

    if (!sala || !estado?.jogadores) {
      logger.warn('Documento inválido em partidas_ativas, ignorando recuperação.', {
        sala: doc.id,
        matchId: doc.id,
      });
      return;
    }

    const jogadores = Object.keys(estado.jogadores).reduce((acc, uid) => {
      acc[uid] = { socketId: null, conectado: false, timerReconexao: null };
      return acc;
    }, {});

    jogosAtivos[sala] = { estado, jogadores };
  });

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.set(
      doc.ref,
      {
        status: 'recuperavel',
        recuperavel: true,
        jogadores: Object.fromEntries(
          Object.keys(doc.data()?.estado?.jogadores || {}).map((uid) => [
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
  const snapshot = await db
    .collection('partidas_ativas')
    .where('expiresAt', '<=', agora)
    .where('status', '==', 'recuperavel')
    .get();

  if (snapshot.empty) return 0;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  logger.info('Partidas abandonadas removidas por TTL.', { quantidade: snapshot.size });
  return snapshot.size;
}

function iniciarLimpezaPeriodica(db, logger = baseLogger) {
  const intervaloMs = 15 * 60 * 1000;
  setInterval(async () => {
    try {
      await limparPartidasAbandonadas(db, logger);
    } catch (error) {
      logger.error('Falha na limpeza periódica de partidas abandonadas.', { error });
    }
  }, intervaloMs);
}

function gerenciarSockets(io, db, logger = baseLogger) {
  io.on('connection', (socket) => {
    metrics.conexoesAtivas += 1;

    if (!socket.user) {
      const motivo = socket.authError || 'Falha na autenticação do socket.';
      const requestId = socket.requestId || createRequestId();
      emitirErroPartida(socket, motivo, { requestId, userId: null }, logger);
      socket.disconnect(true);
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

    socket.on('buscar_partida', async ({ deckId } = {}) => {
      const startedAt = process.hrtime.bigint();
      const requestId = createRequestId();
      const userId = getSocketUid(socket);
      const contexto = { requestId, userId, sala: null, matchId: null };

      try {
        if (!userId) {
          emitirErroPartida(socket, 'Socket não autenticado.', contexto, logger);
          socket.disconnect(true);
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
          socket.emit('status_matchmaking', {
            mensagem: 'Você está na fila, aguardando outro jogador...',
            requestId,
            userId,
            sala: null,
            matchId: null,
          });
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
          updateActiveMatchesMetric();
          await persistirPartidaAtiva(db, nomeDaSala, jogosAtivos[nomeDaSala], {
            status: 'ativa',
            recuperavel: true,
          });
          io.to(nomeDaSala).emit('partida_encontrada', {
            sala: nomeDaSala,
            matchId: nomeDaSala,
            requestId,
            estado: estadoInicial,
          });
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
          io.to(nomeDaSala).emit('erro_partida', {
            motivo,
            requestId,
            sala: nomeDaSala,
            matchId: nomeDaSala,
            userId,
          });
        }
      } finally {
        registrarLatenciaEvento('buscar_partida', startedAt);
      }
    });

    const criarManipuladorDeAcao = (nomeAcao, logicaAcao) => {
      socket.on(nomeAcao, async (dados = {}) => {
        const startedAt = process.hrtime.bigint();
        const requestId = createRequestId();
        let sala = null;
        const userId = getSocketUid(socket);

        try {
          if (!dados || typeof dados !== 'object' || typeof dados.sala !== 'string') {
            payloadInvalido(
              socket,
              `Payload inválido para ${nomeAcao}.`,
              { requestId, userId, sala, matchId: sala },
              logger
            );
            return;
          }

          sala = dados.sala;
          const jogo = jogosAtivos[sala];
          if (!jogo) return;

          const jogador = jogo.jogadores?.[userId];
          if (
            !userId ||
            !jogador ||
            jogador.socketId !== socket.id ||
            !jogador.conectado ||
            userId !== jogo.estado.turno
          )
            return;

          logicaAcao(jogo.estado, userId, dados);
          await persistirPartidaAtiva(db, sala, jogo, { status: 'ativa', recuperavel: true });

          const oponenteId = Object.keys(jogo.estado.jogadores).find((id) => id !== userId);
          if (jogo.estado.jogadores[oponenteId].vida <= 0) {
            await encerrarPartida(io, db, sala, { vencedor: userId, requestId }, logger);
          } else {
            io.to(sala).emit('estado_atualizado', {
              sala,
              matchId: sala,
              requestId,
              estado: jogo.estado,
            });
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
        if (typeof sala !== 'string') {
          payloadInvalido(
            socket,
            'Payload inválido para reconectar_partida.',
            { requestId, userId, sala: null, matchId: null },
            logger
          );
          return;
        }

        const jogo = jogosAtivos[sala];
        if (!jogo) {
          emitirErroPartida(
            socket,
            'Partida não encontrada para reconexão.',
            { requestId, userId, sala, matchId: sala },
            logger
          );
          return;
        }

        if (!userId) {
          emitirErroPartida(
            socket,
            'Socket não autenticado para reconexão.',
            { requestId, userId, sala, matchId: sala },
            logger
          );
          return;
        }

        const jogador = jogo.jogadores?.[userId];
        if (!jogador) {
          emitirErroPartida(
            socket,
            'Jogador não pertence a esta partida.',
            { requestId, userId, sala, matchId: sala },
            logger
          );
          return;
        }

        limparTimerReconexao(jogador);
        jogador.socketId = socket.id;
        jogador.conectado = true;
        socket.join(sala);

        await persistirPartidaAtiva(db, sala, jogo, { status: 'ativa', recuperavel: true });
        io.to(sala).emit('estado_atualizado', {
          sala,
          matchId: sala,
          requestId,
          estado: jogo.estado,
        });
        logger.info('Jogador reconectado na partida.', {
          requestId,
          userId,
          sala,
          matchId: sala,
          socketId: socket.id,
        });
      } finally {
        registrarLatenciaEvento('reconectar_partida', startedAt);
      }
    });

    criarManipuladorDeAcao('passar_turno', (estado, userId) => {
      passarTurno(estado, userId);
    });

    criarManipuladorDeAcao('jogar_carta', (estado, userId, { cartaId }) => {
      if (typeof cartaId !== 'string') {
        payloadInvalido(
          socket,
          'cartaId inválido para jogar_carta.',
          { requestId: createRequestId(), userId, sala: null, matchId: null },
          logger
        );
        return;
      }
      jogarCarta(estado, userId, cartaId);
    });

    criarManipuladorDeAcao('atacar_fortaleza', (estado, userId, { atacantesIds }) => {
      if (!Array.isArray(atacantesIds)) {
        payloadInvalido(
          socket,
          'atacantesIds inválido para atacar_fortaleza.',
          { requestId: createRequestId(), userId, sala: null, matchId: null },
          logger
        );
        return;
      }
      atacarFortaleza(estado, userId, atacantesIds);
    });

    criarManipuladorDeAcao('declarar_ataque', (estado, userId, { atacanteId, alvoId }) => {
      if (typeof atacanteId !== 'string' || typeof alvoId !== 'string') {
        payloadInvalido(
          socket,
          'atacanteId/alvoId inválido para declarar_ataque.',
          { requestId: createRequestId(), userId, sala: null, matchId: null },
          logger
        );
        return;
      }
      declararAtaque(estado, userId, atacanteId, alvoId);
    });

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

      const jogoEncontrado = buscarJogoPorSocketId(socket.id);
      if (!jogoEncontrado) return;

      const [sala, jogo] = jogoEncontrado;
      const userId = getSocketUid(socket);
      const jogador = userId ? jogo.jogadores?.[userId] : null;
      if (!jogador || jogador.socketId !== socket.id) return;

      jogador.conectado = false;
      limparTimerReconexao(jogador);
      jogador.timerReconexao = setTimeout(async () => {
        const jogoAtual = jogosAtivos[sala];
        const jogadorAtual = jogoAtual?.jogadores?.[userId];
        if (!jogadorAtual || jogadorAtual.conectado) return;

        const oponenteId = Object.keys(jogoAtual.estado.jogadores).find((id) => id !== userId);
        const payloadFim = { motivo: 'desconexao', jogadorDesconectado: userId, requestId };
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
gerenciarSockets.iniciarLimpezaPeriodica = iniciarLimpezaPeriodica;
gerenciarSockets.getMetrics = getMetrics;

module.exports = gerenciarSockets;
