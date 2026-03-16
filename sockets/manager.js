const { criarEstadoInicialDoJogo } = require('../game/logic');
const { passarTurno, jogarCarta, atacarFortaleza, declararAtaque } = require('../game/actions');

const jogosAtivos = {};
let filaDeEspera = null;

function payloadInvalido(socket, mensagem) {
    socket.emit('erro_partida', { mensagem });
}

function gerenciarSockets(io, db) {
    io.on('connection', (socket) => {
        console.log(`[CONEXÃO] Jogador conectado: ${socket.id}`);

        socket.on('buscar_partida', async ({ deckId, userId } = {}) => {
            if (!deckId || !userId) return;

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
                    const socketMap = { [j1Socket.id]: u1, [j2Socket.id]: u2 };
                    jogosAtivos[nomeDaSala] = { estado: estadoInicial, socketIdParaUid: socketMap };
                    io.to(nomeDaSala).emit('partida_encontrada', { sala: nomeDaSala, estado: estadoInicial });
                    console.log(`[MATCH] Partida criada e enviada com sucesso para a sala ${nomeDaSala}`);
                } catch (error) {
                    console.error('Erro crítico ao criar o estado do jogo:', error);
                    io.to(nomeDaSala).emit('erro_partida', { mensagem: 'Não foi possível carregar os baralhos.' });
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

                const userId = jogo.socketIdParaUid[socket.id];
                if (!userId || userId !== jogo.estado.turno) return;

                logicaAcao(jogo.estado, userId, dados);

                const oponenteId = Object.keys(jogo.estado.jogadores).find((id) => id !== userId);
                if (jogo.estado.jogadores[oponenteId].vida <= 0) {
                    io.to(sala).emit('fim_de_jogo', { vencedor: userId });
                    delete jogosAtivos[sala];
                } else {
                    io.to(sala).emit('estado_atualizado', jogo.estado);
                }
            });
        };

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
        });
    });
}

module.exports = gerenciarSockets;
