const { criarEstadoInicialDoJogo } = require('../game/logic');
const { passarTurno, jogarCarta, atacarFortaleza, declararAtaque } = require('../game/actions');

const jogosAtivos = {};
let filaDeEspera = null;
const TEMPO_LIMITE_RECONEXAO_MS = 60 * 1000;
const TTL_PARTIDA_ABANDONADA_MS = 24 * 60 * 60 * 1000;

function emitirErroPartida(socket, motivo) {
    socket.emit('erro_partida', { motivo });
}

function payloadInvalido(socket, mensagem) {
    emitirErroPartida(socket, mensagem);
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
            Object.entries(jogo.jogadores || {}).map(([uid, jogador]) => [uid, {
                conectado: Boolean(jogador?.conectado),
                socketId: jogador?.socketId || null,
            }]),
        ),
        updatedAt: new Date(),
        expiresAt: calcularExpiracaoTTL(),
        status: extras.status || 'ativa',
        recuperavel: extras.recuperavel ?? true,
        ...extras,
    };
}

async function persistirPartidaAtiva(db, sala, jogo, extras = {}) {
    await db.collection('partidas_ativas').doc(sala).set(montarSnapshotPartida(sala, jogo, extras), { merge: true });
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

async function encerrarPartida(io, db, sala, payload) {
    const jogo = jogosAtivos[sala];
    if (!jogo) return;

    Object.values(jogo.jogadores || {}).forEach((metaJogador) => limparTimerReconexao(metaJogador));

    try {
        await moverPartidaParaHistorico(db, sala, jogo, payload);
    } catch (error) {
        console.error(`[PERSISTÊNCIA] Falha ao mover partida ${sala} para histórico:`, error);
    }

    io.to(sala).emit('fim_de_jogo', payload);
    delete jogosAtivos[sala];
}

function buscarJogoPorSocketId(socketId) {
    return Object.entries(jogosAtivos).find(([, jogo]) => {
        return Object.values(jogo.jogadores || {}).some((metaJogador) => metaJogador.socketId === socketId);
    });
}

async function carregarPartidasRecuperaveis(db) {
    const snapshot = await db.collection('partidas_ativas').where('status', 'in', ['ativa', 'recuperavel']).get();

    if (snapshot.empty) {
        console.log('[RECOVERY] Nenhuma partida ativa para recuperar no startup.');
        return 0;
    }

    snapshot.forEach((doc) => {
        const data = doc.data();
        const sala = data.sala || doc.id;
        const estado = data.estado;

        if (!sala || !estado?.jogadores) {
            console.warn(`[RECOVERY] Documento inválido em partidas_ativas (${doc.id}). Ignorando.`);
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
        batch.set(doc.ref, {
            status: 'recuperavel',
            recuperavel: true,
            jogadores: Object.fromEntries(
                Object.keys((doc.data()?.estado?.jogadores) || {}).map((uid) => [uid, { conectado: false, socketId: null }]),
            ),
            updatedAt: new Date(),
            expiresAt: calcularExpiracaoTTL(),
        }, { merge: true });
    });
    await batch.commit();

    console.log(`[RECOVERY] ${snapshot.size} partida(s) carregada(s) e marcada(s) como recuperável(is).`);
    return snapshot.size;
}

async function limparPartidasAbandonadas(db) {
    const agora = new Date();
    const snapshot = await db.collection('partidas_ativas')
        .where('expiresAt', '<=', agora)
        .where('status', '==', 'recuperavel')
        .get();

    if (snapshot.empty) return 0;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    console.log(`[TTL] ${snapshot.size} partida(s) abandonada(s) removida(s) da coleção partidas_ativas.`);
    return snapshot.size;
}

function iniciarLimpezaPeriodica(db) {
    const intervaloMs = 15 * 60 * 1000;
    setInterval(async () => {
        try {
            await limparPartidasAbandonadas(db);
        } catch (error) {
            console.error('[TTL] Falha na limpeza periódica de partidas abandonadas:', error);
        }
    }, intervaloMs);
}

function gerenciarSockets(io, db) {
    io.on('connection', (socket) => {
        if (!socket.user) {
            const motivo = socket.authError || 'Falha na autenticação do socket.';
            emitirErroPartida(socket, motivo);
            socket.disconnect(true);
            return;
        }

        const socketUid = getSocketUid(socket);
        console.log(`[CONEXÃO] Jogador autenticado conectado: ${socket.id} (uid: ${socketUid})`);

        socket.on('buscar_partida', async ({ deckId } = {}) => {
            const userId = getSocketUid(socket);
            if (!userId) {
                emitirErroPartida(socket, 'Socket não autenticado.');
                socket.disconnect(true);
                return;
            }

            if (!deckId) {
                payloadInvalido(socket, 'deckId é obrigatório para buscar_partida.');
                return;
            }

            if (filaDeEspera && filaDeEspera.userId === userId) {
                console.log(`[FILA] Jogador ${userId} já está na fila. Ignorando nova requisição.`);
                return;
            }

            console.log(`[FILA] Jogador ${userId} (socket ${socket.id}) protocolou busca com o baralho ${deckId}`);

            if (!filaDeEspera) {
                filaDeEspera = { socket, deckId, userId };
                socket.emit('status_matchmaking', 'Você está na fila, aguardando outro jogador...');
                console.log(`[FILA] ${userId} (${socket.id}) é o primeiro na fila. Fila agora tem 1 jogador.`);
            } else {
                console.log('[MATCH] Fila tem um jogador. Formando partida...');
                const { socket: j1Socket, deckId: d1, userId: u1 } = filaDeEspera;
                const { socket: j2Socket, deckId: d2, userId: u2 } = { socket, deckId, userId };

                filaDeEspera = null;
                console.log('[MATCH] Fila esvaziada.');

                const nomeDaSala = `sala_${j1Socket.id}_${j2Socket.id}`;
                j1Socket.join(nomeDaSala);
                j2Socket.join(nomeDaSala);

                console.log(`[MATCH] Matchmaking! J1(${u1}) vs J2(${u2}) na sala ${nomeDaSala}`);

                try {
                    const estadoInicial = await criarEstadoInicialDoJogo(db, u1, d1, u2, d2);
                    jogosAtivos[nomeDaSala] = {
                        estado: estadoInicial,
                        jogadores: {
                            [u1]: { socketId: j1Socket.id, conectado: true, timerReconexao: null },
                            [u2]: { socketId: j2Socket.id, conectado: true, timerReconexao: null },
                        },
                    };
                    await persistirPartidaAtiva(db, nomeDaSala, jogosAtivos[nomeDaSala], { status: 'ativa', recuperavel: true });
                    io.to(nomeDaSala).emit('partida_encontrada', { sala: nomeDaSala, estado: estadoInicial });
                    console.log(`[MATCH] Partida criada e enviada com sucesso para a sala ${nomeDaSala}`);
                } catch (error) {
                    const motivo = error?.code === 'DECK_INVALIDO'
                        ? error.message
                        : 'Não foi possível carregar os baralhos.';
                    console.error('[MATCH] Erro ao criar estado inicial:', {
                        sala: nomeDaSala,
                        jogadores: [{ uid: u1, deckId: d1 }, { uid: u2, deckId: d2 }],
                        erro: error,
                    });
                    io.to(nomeDaSala).emit('erro_partida', { motivo });
                }
            }
        });

        const criarManipuladorDeAcao = (nomeAcao, logicaAcao) => {
            socket.on(nomeAcao, async (dados = {}) => {
                if (!dados || typeof dados !== 'object' || typeof dados.sala !== 'string') {
                    payloadInvalido(socket, `Payload inválido para ${nomeAcao}.`);
                    return;
                }

                const sala = dados.sala;
                const jogo = jogosAtivos[sala];
                if (!jogo) return;

                const userId = getSocketUid(socket);
                const jogador = jogo.jogadores?.[userId];
                if (!userId || !jogador || jogador.socketId !== socket.id || !jogador.conectado || userId !== jogo.estado.turno) return;

                logicaAcao(jogo.estado, userId, dados);
                await persistirPartidaAtiva(db, sala, jogo, { status: 'ativa', recuperavel: true });

                const oponenteId = Object.keys(jogo.estado.jogadores).find((id) => id !== userId);
                if (jogo.estado.jogadores[oponenteId].vida <= 0) {
                    await encerrarPartida(io, db, sala, { vencedor: userId });
                } else {
                    io.to(sala).emit('estado_atualizado', jogo.estado);
                }
            });
        };

        socket.on('reconectar_partida', async ({ sala } = {}) => {
            if (typeof sala !== 'string') {
                payloadInvalido(socket, 'Payload inválido para reconectar_partida.');
                return;
            }

            const jogo = jogosAtivos[sala];
            if (!jogo) {
                emitirErroPartida(socket, 'Partida não encontrada para reconexão.');
                return;
            }

            const userId = getSocketUid(socket);
            if (!userId) {
                emitirErroPartida(socket, 'Socket não autenticado para reconexão.');
                return;
            }

            const jogador = jogo.jogadores?.[userId];
            if (!jogador) {
                emitirErroPartida(socket, 'Jogador não pertence a esta partida.');
                return;
            }

            limparTimerReconexao(jogador);
            jogador.socketId = socket.id;
            jogador.conectado = true;
            socket.join(sala);

            await persistirPartidaAtiva(db, sala, jogo, { status: 'ativa', recuperavel: true });
            io.to(sala).emit('estado_atualizado', jogo.estado);
            console.log(`[RECONEXÃO] Jogador ${userId} reconectado na sala ${sala} com socket ${socket.id}`);
        });

        criarManipuladorDeAcao('passar_turno', (estado, userId) => {
            passarTurno(estado, userId);
        });

        criarManipuladorDeAcao('jogar_carta', (estado, userId, { cartaId }) => {
            if (typeof cartaId !== 'string') {
                payloadInvalido(socket, 'cartaId inválido para jogar_carta.');
                return;
            }
            jogarCarta(estado, userId, cartaId);
        });

        criarManipuladorDeAcao('atacar_fortaleza', (estado, userId, { atacantesIds }) => {
            if (!Array.isArray(atacantesIds)) {
                payloadInvalido(socket, 'atacantesIds inválido para atacar_fortaleza.');
                return;
            }
            atacarFortaleza(estado, userId, atacantesIds);
        });

        criarManipuladorDeAcao('declarar_ataque', (estado, userId, { atacanteId, alvoId }) => {
            if (typeof atacanteId !== 'string' || typeof alvoId !== 'string') {
                payloadInvalido(socket, 'atacanteId/alvoId inválido para declarar_ataque.');
                return;
            }
            declararAtaque(estado, userId, atacanteId, alvoId);
        });

        socket.on('disconnect', () => {
            console.log(`[DESCONEXÃO] Jogador desconectado: ${socket.id}`);
            if (filaDeEspera && filaDeEspera.socket.id === socket.id) {
                console.log(`[FILA] O jogador ${filaDeEspera.userId} que estava na fila desconectou.`);
                filaDeEspera = null;
                console.log('[FILA] Fila foi limpa.');
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
                const payloadFim = { motivo: 'desconexao', jogadorDesconectado: userId };
                if (oponenteId) payloadFim.vencedor = oponenteId;
                await encerrarPartida(io, db, sala, payloadFim);
            }, TEMPO_LIMITE_RECONEXAO_MS);

            persistirPartidaAtiva(db, sala, jogo, { status: 'recuperavel', recuperavel: true }).catch((error) => {
                console.error(`[PERSISTÊNCIA] Falha ao atualizar status de reconexão da sala ${sala}:`, error);
            });

            console.log(`[DESCONEXÃO] Jogador ${userId} desconectado da sala ${sala}. Aguardando reconexão por ${TEMPO_LIMITE_RECONEXAO_MS / 1000}s.`);
        });
    });
}

gerenciarSockets.carregarPartidasRecuperaveis = carregarPartidasRecuperaveis;
gerenciarSockets.iniciarLimpezaPeriodica = iniciarLimpezaPeriodica;

module.exports = gerenciarSockets;
