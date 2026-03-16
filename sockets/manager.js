const { criarEstadoInicialDoJogo } = require('../game/logic');
const { passarTurno, jogarCarta, atacarFortaleza, declararAtaque } = require('../game/actions');

const jogosAtivos = {};
let filaDeEspera = null;
const TEMPO_LIMITE_RECONEXAO_MS = 60 * 1000;

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

function encerrarPartida(io, sala, payload) {
    const jogo = jogosAtivos[sala];
    if (!jogo) return;

    Object.values(jogo.jogadores || {}).forEach((metaJogador) => limparTimerReconexao(metaJogador));
    io.to(sala).emit('fim_de_jogo', payload);
    delete jogosAtivos[sala];
}

function buscarJogoPorSocketId(socketId) {
    return Object.entries(jogosAtivos).find(([, jogo]) => {
        return Object.values(jogo.jogadores || {}).some((metaJogador) => metaJogador.socketId === socketId);
    });
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
                    io.to(nomeDaSala).emit('partida_encontrada', { sala: nomeDaSala, estado: estadoInicial });
                    console.log(`[MATCH] Partida criada e enviada com sucesso para a sala ${nomeDaSala}`);
                } catch (error) {
                    console.error('Erro crítico ao criar o estado do jogo:', error);
                    io.to(nomeDaSala).emit('erro_partida', { motivo: 'Não foi possível carregar os baralhos.' });
                }
            }
        });

        const criarManipuladorDeAcao = (nomeAcao, logicaAcao) => {
            socket.on(nomeAcao, (dados = {}) => {
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

                const oponenteId = Object.keys(jogo.estado.jogadores).find((id) => id !== userId);
                if (jogo.estado.jogadores[oponenteId].vida <= 0) {
                    encerrarPartida(io, sala, { vencedor: userId });
                } else {
                    io.to(sala).emit('estado_atualizado', jogo.estado);
                }
            });
        };

        socket.on('reconectar_partida', ({ sala } = {}) => {
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
            jogador.timerReconexao = setTimeout(() => {
                const jogoAtual = jogosAtivos[sala];
                const jogadorAtual = jogoAtual?.jogadores?.[userId];
                if (!jogadorAtual || jogadorAtual.conectado) return;

                const oponenteId = Object.keys(jogoAtual.estado.jogadores).find((id) => id !== userId);
                const payloadFim = { motivo: 'desconexao', jogadorDesconectado: userId };
                if (oponenteId) payloadFim.vencedor = oponenteId;
                encerrarPartida(io, sala, payloadFim);
            }, TEMPO_LIMITE_RECONEXAO_MS);

            console.log(`[DESCONEXÃO] Jogador ${userId} desconectado da sala ${sala}. Aguardando reconexão por ${TEMPO_LIMITE_RECONEXAO_MS / 1000}s.`);
        });
    });
}

module.exports = gerenciarSockets;
