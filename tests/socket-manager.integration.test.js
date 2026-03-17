const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { Server } = require('socket.io');
const { io: ioc } = require('./helpers/socketio-client');

const gerenciarSockets = require('../sockets/manager');

const tempoLimiteReconexaoMs = 60 * 1000;
const setTimeoutOriginal = global.setTimeout;
global.setTimeout = (fn, ms, ...args) => {
  const timer = setTimeoutOriginal(fn, ms, ...args);
  if (ms === tempoLimiteReconexaoMs && typeof timer?.unref === 'function') {
    timer.unref();
  }
  return timer;
};

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

function criarCartasMestras(ids) {
  return Object.fromEntries(
    ids.map((id) => [id, { Nome: `Carta ${id}`, C: 0, M: 0, O: 0, A: 0, Força: 200, Vida: 100 }])
  );
}

function criarDbFake() {
  const cardIds = Array.from({ length: 10 }, (_, i) => `carta_${i + 1}`);
  const deck = cardIds.flatMap((id) => [id, id, id]);

  const state = {
    usuarios: {
      p1: { baralhos: { deck_p1: { cartas: deck } } },
      p2: { baralhos: { deck_p2: { cartas: deck } } },
    },
    cartas_mestras: criarCartasMestras(cardIds),
    partidas_ativas: {},
    partidas_historico: {},
  };

  const criarSnapshotQuery = (docs) => ({
    empty: docs.length === 0,
    size: docs.length,
    docs,
    forEach: (cb) => docs.forEach(cb),
  });

  const collectionApi = (name) => ({
    doc: (id) => ({
      collection: (subName) => ({
        doc: (subId) => ({
          async get() {
            const data = state[name]?.[id]?.[subName]?.[subId];
            return {
              exists: Boolean(data),
              id: subId,
              data: () => data,
            };
          },
        }),
      }),
      async set(payload, options = {}) {
        if (!state[name][id] || !options.merge) {
          state[name][id] = payload;
          return;
        }

        state[name][id] = { ...state[name][id], ...payload };
      },
      async delete() {
        delete state[name][id];
      },
      ref: { collection: name, id },
      id,
      data: () => state[name][id],
    }),
    where: (field, op, value) => ({
      async get() {
        if (name === 'cartas_mestras') {
          const docs = value
            .map((id) => ({
              id,
              data: () => state.cartas_mestras[id],
            }))
            .filter((doc) => doc.data());

          return criarSnapshotQuery(docs);
        }

        if (name === 'partidas_ativas') {
          const docs = Object.entries(state.partidas_ativas)
            .filter(([, partida]) => {
              if (field === 'status' && op === 'in') return value.includes(partida.status);
              if (field === 'status' && op === '==') return partida.status === value;
              if (field === 'expiresAt' && op === '<=')
                return partida.expiresAt && partida.expiresAt <= value;
              return true;
            })
            .map(([id, partida]) => ({
              id,
              data: () => partida,
              ref: { id, collection: name },
            }));

          return criarSnapshotQuery(docs);
        }

        return criarSnapshotQuery([]);
      },
    }),
  });

  return {
    state,
    collection: collectionApi,
    batch() {
      const ops = [];
      return {
        set(ref, payload, options) {
          ops.push(() => collectionApi(ref.collection).doc(ref.id).set(payload, options));
        },
        delete(ref) {
          ops.push(() => collectionApi(ref.collection).doc(ref.id).delete());
        },
        async commit() {
          await Promise.all(ops.map((op) => op()));
        },
      };
    },
  };
}

function waitForEvent(socket, event, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout aguardando evento: ${event}`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      socket.off(event, onEvent);
    };

    const onEvent = (payload) => {
      cleanup();
      resolve(payload);
    };

    socket.once(event, onEvent);
  });
}

async function esperarSilencio(socket, event, timeoutMs = 300) {
  let recebeu = false;
  const handler = () => {
    recebeu = true;
  };

  socket.on(event, handler);
  await new Promise((resolve) => setTimeout(resolve, timeoutMs));
  socket.off(event, handler);

  assert.equal(recebeu, false, `Evento inesperado recebido: ${event}`);
}

async function criarAmbiente() {
  const db = criarDbFake();
  const appServer = http.createServer();
  const io = new Server(appServer, { cors: { origin: '*' } });

  io.use((socket, next) => {
    socket.user = { uid: socket.handshake.auth.token };
    next();
  });

  gerenciarSockets(io, db, noopLogger);

  await new Promise((resolve) => appServer.listen(0, resolve));
  const port = appServer.address().port;

  const criarCliente = (uid) =>
    ioc(`http://127.0.0.1:${port}`, {
      auth: { token: uid },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });

  const p1 = criarCliente('p1');
  const p2 = criarCliente('p2');

  await Promise.all([
    new Promise((resolve) => p1.on('connect', resolve)),
    new Promise((resolve) => p2.on('connect', resolve)),
  ]);

  async function encerrar() {
    p1.disconnect();
    p2.disconnect();
    io.close();
    await new Promise((resolve) => appServer.close(resolve));
  }

  return { db, p1, p2, encerrar, criarCliente };
}

test('integração socket: buscar_partida -> ações -> fim_de_jogo', async () => {
  const { db, p1, p2, encerrar } = await criarAmbiente();

  try {
    p1.emit('buscar_partida', { deckId: 'deck_p1' });
    p2.emit('buscar_partida', { deckId: 'deck_p2' });

    const partidaP1 = await waitForEvent(p1, 'partida_encontrada');
    const partidaP2 = await waitForEvent(p2, 'partida_encontrada');

    assert.equal(partidaP1.protocolVersion, '1.1.0');
    assert.equal(partidaP2.protocolVersion, '1.1.0');
    assert.equal(partidaP1.sala, partidaP2.sala);
    assert.equal(partidaP1.estado.turno, 'p1');

    const sala = partidaP1.sala;
    const cartaId = partidaP1.estado.jogadores.p1.mao[0].id;

    p1.emit('jogar_carta', { sala, cartaId });
    await waitForEvent(p1, 'estado_atualizado');

    const avancarFase = async (socket) => {
      socket.emit('passar_turno', { sala });
      return waitForEvent(socket, 'estado_atualizado');
    };

    await avancarFase(p1); // Guerra dos Véus
    await avancarFase(p1); // Silêncio Final
    await avancarFase(p1); // Ritual de Geração (turno p2)

    await avancarFase(p2); // Revelação
    await avancarFase(p2); // Manifestação
    await avancarFase(p2); // Guerra dos Véus
    await avancarFase(p2); // Silêncio Final
    await avancarFase(p2); // Ritual de Geração (turno p1)

    await avancarFase(p1); // Revelação
    await avancarFase(p1); // Manifestação
    const atualizado = await avancarFase(p1); // Guerra dos Véus
    assert.equal(atualizado.estado.turno, 'p1');
    assert.equal(atualizado.estado.fase, 'Guerra dos Véus');

    p1.emit('atacar_fortaleza', { sala, atacantesIds: [cartaId] });
    const fim = await waitForEvent(p1, 'fim_de_jogo');

    assert.equal(fim.vencedor, 'p1');
    assert.equal(fim.sala, sala);

    const partidaAtiva = db.state.partidas_ativas[sala];
    const partidaHistorico = db.state.partidas_historico[sala];
    assert.equal(partidaAtiva, undefined);
    assert.ok(partidaHistorico);
    assert.equal(partidaHistorico.status, 'finalizada');
    assert.equal(partidaHistorico.fim.vencedor, 'p1');
    assert.ok(partidaHistorico.estado.turno);
    assert.ok(partidaHistorico.estadoCompleto.jogadores.p1.mao);
  } finally {
    await encerrar();
  }
});

test('integração socket: payload inválido em eventos e servidor continua estável', async () => {
  const { p1, p2, encerrar } = await criarAmbiente();

  try {
    p1.emit('buscar_partida', {});
    const erroBusca = await waitForEvent(p1, 'erro_partida');
    assert.equal(erroBusca.protocolVersion, '1.1.0');
    assert.match(erroBusca.motivo, /deckId é obrigatório/);

    p1.emit('buscar_partida', { deckId: 'deck_p1' });
    p2.emit('buscar_partida', { deckId: 'deck_p2' });
    const { sala } = await waitForEvent(p1, 'partida_encontrada');
    await waitForEvent(p2, 'partida_encontrada');

    p1.emit('passar_turno', 'payload-invalido');
    const erroPassar = await waitForEvent(p1, 'erro_partida');
    assert.match(erroPassar.motivo, /Payload inválido para passar_turno/);

    p1.emit('jogar_carta', { sala, cartaId: 123 });
    const erroJogar = await waitForEvent(p1, 'erro_partida');
    assert.match(erroJogar.motivo, /cartaId inválido/);

    p1.emit('atacar_fortaleza', { sala, atacantesIds: 'x' });
    const erroFortaleza = await waitForEvent(p1, 'erro_partida');
    assert.match(erroFortaleza.motivo, /atacantesIds inválido/);

    p1.emit('declarar_ataque', { sala, atacanteId: 1, alvoId: 2 });
    const erroAtaque = await waitForEvent(p1, 'erro_partida');
    assert.match(erroAtaque.motivo, /atacanteId\/alvoId inválido/);

    p1.emit('reconectar_partida', { sala: 'sala_inexistente' });
    const erroReconexao = await waitForEvent(p1, 'erro_partida');
    assert.match(erroReconexao.motivo, /Partida não encontrada para reconexão/);

    p1.emit('passar_turno', { sala });
    const atualizado = await waitForEvent(p1, 'estado_atualizado');
    assert.equal(atualizado.estado.turno, 'p1');
    assert.equal(atualizado.estado.fase, 'Guerra dos Véus');
  } finally {
    await encerrar();
  }
});

test('integração socket: ação fora do turno não altera estado', async () => {
  const { p1, p2, encerrar } = await criarAmbiente();

  try {
    p1.emit('buscar_partida', { deckId: 'deck_p1' });
    p2.emit('buscar_partida', { deckId: 'deck_p2' });

    const partida = await waitForEvent(p1, 'partida_encontrada');
    await waitForEvent(p2, 'partida_encontrada');

    const sala = partida.sala;
    p2.emit('passar_turno', { sala });

    await esperarSilencio(p1, 'estado_atualizado');

    p1.emit('passar_turno', { sala });
    const atualizado = await waitForEvent(p1, 'estado_atualizado');
    assert.equal(atualizado.estado.turno, 'p1');
    assert.equal(atualizado.estado.fase, 'Guerra dos Véus');
  } finally {
    await encerrar();
  }
});



test('integração socket: ação inválida por fase emite erro_partida com contexto', async () => {
  const { p1, p2, encerrar } = await criarAmbiente();

  try {
    p1.emit('buscar_partida', { deckId: 'deck_p1' });
    p2.emit('buscar_partida', { deckId: 'deck_p2' });

    const partida = await waitForEvent(p1, 'partida_encontrada');
    await waitForEvent(p2, 'partida_encontrada');

    p1.emit('atacar_fortaleza', { sala: partida.sala, atacantesIds: [] });
    const erro = await waitForEvent(p1, 'erro_partida');

    assert.equal(erro.codigo, 'ACAO_FASE_INVALIDA');
    assert.equal(erro.acao, 'atacar_fortaleza');
    assert.equal(erro.faseAtual, 'Manifestação');
    assert.equal(erro.fasesPermitidas.length, 1);
    assert.equal(erro.fasesPermitidas[0], 'Guerra dos Véus');
  } finally {
    await encerrar();
  }
});

test('integração socket: desconexão e reconexão preservam partida ativa', async () => {
  const { p1, p2, encerrar, criarCliente } = await criarAmbiente();

  try {
    p1.emit('buscar_partida', { deckId: 'deck_p1' });
    p2.emit('buscar_partida', { deckId: 'deck_p2' });

    const partida = await waitForEvent(p1, 'partida_encontrada');
    await waitForEvent(p2, 'partida_encontrada');

    const sala = partida.sala;
    p1.disconnect();

    const p1Reconectado = criarCliente('p1');
    await new Promise((resolve) => p1Reconectado.on('connect', resolve));

    p1Reconectado.emit('reconectar_partida', { sala });
    const estadoReconectado = await waitForEvent(p1Reconectado, 'estado_atualizado');
    assert.equal(estadoReconectado.sala, sala);

    await esperarSilencio(p2, 'fim_de_jogo', 500);
    p1Reconectado.disconnect();
  } finally {
    await encerrar();
  }
});

test('integração socket: reconexão sem sala usa vínculo uid -> sala ativa', async () => {
  const { p1, p2, encerrar, criarCliente } = await criarAmbiente();

  try {
    p1.emit('buscar_partida', { deckId: 'deck_p1' });
    p2.emit('buscar_partida', { deckId: 'deck_p2' });

    const partida = await waitForEvent(p1, 'partida_encontrada');
    await waitForEvent(p2, 'partida_encontrada');

    p1.disconnect();

    const p1Reconectado = criarCliente('p1');
    await new Promise((resolve) => p1Reconectado.on('connect', resolve));

    p1Reconectado.emit('reconectar_partida', {});
    const estadoReconectado = await waitForEvent(p1Reconectado, 'estado_atualizado');
    assert.equal(estadoReconectado.sala, partida.sala);

    await esperarSilencio(p2, 'fim_de_jogo', 500);
    p1Reconectado.disconnect();
  } finally {
    await encerrar();
  }
});

test('integração socket: timeout de reconexão encerra partida por desconexão', async () => {
  const setTimeoutTemp = global.setTimeout;
  global.setTimeout = (fn, ms, ...args) => {
    if (ms === tempoLimiteReconexaoMs) {
      return setTimeoutOriginal(fn, 20, ...args);
    }

    return setTimeoutTemp(fn, ms, ...args);
  };

  const { db, p1, p2, encerrar } = await criarAmbiente();

  try {
    p1.emit('buscar_partida', { deckId: 'deck_p1' });
    p2.emit('buscar_partida', { deckId: 'deck_p2' });

    const partida = await waitForEvent(p1, 'partida_encontrada');
    await waitForEvent(p2, 'partida_encontrada');

    p1.disconnect();

    const fim = await waitForEvent(p2, 'fim_de_jogo');
    assert.equal(fim.sala, partida.sala);
    assert.equal(fim.motivo, 'abandono/desconexao');
    assert.equal(fim.vencedor, 'p2');
    assert.equal(fim.jogadorDesconectado, 'p1');

    assert.equal(db.state.partidas_ativas[partida.sala], undefined);
    assert.equal(db.state.partidas_historico[partida.sala].status, 'finalizada');
  } finally {
    global.setTimeout = setTimeoutTemp;
    await encerrar();
  }
});

test('integração socket: snapshot simplificado é salvo nas partidas ativas', async () => {
  const { db, p1, p2, encerrar } = await criarAmbiente();

  try {
    p1.emit('buscar_partida', { deckId: 'deck_p1' });
    p2.emit('buscar_partida', { deckId: 'deck_p2' });

    const partida = await waitForEvent(p1, 'partida_encontrada');
    await waitForEvent(p2, 'partida_encontrada');

    const snapshotAtivo = db.state.partidas_ativas[partida.sala];
    assert.ok(snapshotAtivo);
    assert.equal(snapshotAtivo.sala, partida.sala);
    assert.equal(snapshotAtivo.status, 'ativa');
    assert.ok(snapshotAtivo.updatedAt instanceof Date);
    assert.ok(snapshotAtivo.expiresAt instanceof Date);
    assert.equal(typeof snapshotAtivo.estado.jogadores.p1.baralhoRestante, 'number');
    assert.equal(Array.isArray(snapshotAtivo.estado.jogadores.p1.mao), true);
    assert.equal(Array.isArray(snapshotAtivo.estadoCompleto.jogadores.p1.mao), true);
  } finally {
    await encerrar();
  }
});


test('startup ignora e remove partidas expiradas ao carregar recuperáveis', async () => {
  const db = criarDbFake();

  db.state.partidas_ativas.sala_expirada = {
    sala: 'sala_expirada',
    status: 'ativa',
    estadoCompleto: { jogadores: { p1: { vida: 100 }, p2: { vida: 100 } } },
    expiresAt: new Date(Date.now() - 1000),
  };

  db.state.partidas_ativas.sala_valida = {
    sala: 'sala_valida',
    status: 'ativa',
    estadoCompleto: { jogadores: { p1: { vida: 100 }, p2: { vida: 100 } } },
    expiresAt: new Date(Date.now() + 60_000),
  };

  const carregadas = await gerenciarSockets.carregarPartidasRecuperaveis(db, noopLogger);
  assert.equal(carregadas, 2);
  assert.equal(db.state.partidas_ativas.sala_expirada, undefined);
  assert.equal(db.state.partidas_ativas.sala_valida.status, 'recuperavel');
});

test('startup recupera partidas pausadas e pendentes', async () => {
  const db = criarDbFake();

  db.state.partidas_ativas.sala_pausada = {
    sala: 'sala_pausada',
    status: 'pausada',
    estadoCompleto: { jogadores: { p1: { vida: 100 }, p2: { vida: 100 } } },
    expiresAt: new Date(Date.now() + 60_000),
  };

  db.state.partidas_ativas.sala_pendente = {
    sala: 'sala_pendente',
    status: 'pendente',
    estadoCompleto: { jogadores: { p1: { vida: 100 }, p2: { vida: 100 } } },
    expiresAt: new Date(Date.now() + 60_000),
  };

  const carregadas = await gerenciarSockets.carregarPartidasRecuperaveis(db, noopLogger);
  assert.equal(carregadas, 2);
  assert.equal(db.state.partidas_ativas.sala_pausada.status, 'recuperavel');
  assert.equal(db.state.partidas_ativas.sala_pendente.status, 'recuperavel');
});

test('limpeza TTL remove partidas órfãs expiradas', async () => {
  const db = criarDbFake();
  const { limparPartidasAbandonadas } = gerenciarSockets.__testables;

  db.state.partidas_ativas.sala_expirada = {
    sala: 'sala_expirada',
    status: 'recuperavel',
    estado: { jogadores: { p1: { vida: 100 }, p2: { vida: 100 } } },
    expiresAt: new Date(Date.now() - 1000),
  };

  db.state.partidas_ativas.sala_valida = {
    sala: 'sala_valida',
    status: 'recuperavel',
    estado: { jogadores: { p1: { vida: 100 }, p2: { vida: 100 } } },
    expiresAt: new Date(Date.now() + 60_000),
  };

  const removidas = await limparPartidasAbandonadas(db, noopLogger);
  assert.equal(removidas, 1);
  assert.equal(db.state.partidas_ativas.sala_expirada, undefined);
  assert.ok(db.state.partidas_ativas.sala_valida);
});
