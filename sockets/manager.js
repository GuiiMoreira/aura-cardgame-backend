const { criarEstadoInicialDoJogo } = require('../game/logic');

const jogosAtivos = {};
const socketIdParaUserId = {};
const userIdParaSocketId = {};
const TEMPO_RECONEXAO_MS = 30_000;

let filaDeEspera = null;

function emitirErroPayloadInvalido(socket, nomeAcao, detalhe) {
    socket.emit('erro_partida', {
        mensagem: `Payload inválido para ${nomeAcao}. ${detalhe}`
    });
}

function validarPayloadBasico(socket, nomeAcao, dados) {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
        emitirErroPayloadInvalido(socket, nomeAcao, 'Envie um objeto válido.');
        return null;
    }

    if (typeof dados.sala !== 'string' || !dados.sala.trim()) {
        emitirErroPayloadInvalido(socket, nomeAcao, 'O campo "sala" deve ser uma string não vazia.');
        return null;
    }

    return dados;
}

function validarStringObrigatoria(socket, nomeAcao, valor, campo) {
    if (typeof valor !== 'string' || !valor.trim()) {
        emitirErroPayloadInvalido(socket, nomeAcao, `O campo "${campo}" deve ser uma string não vazia.`);
        return false;
    }

    return true;
}

function moverMortosParaCemiterio(estado, jogadorId) {
    estado.campo[jogadorId] = estado.campo[jogadorId].filter(carta => {
        if (carta.Vida <= 0) {
            estado.jogadores[jogadorId].cemiterio.push(carta);
            return false;
        }
        return true;
    });
}

function resolverCombateDeclarado(estado, userId, atacanteId, alvoId) {
    const oponenteId = Object.keys(estado.jogadores).find(id => id !== userId);
    const cartaAtacante = estado.campo[userId].find(c => c.id === atacanteId);
    const cartaAlvo = estado.campo[oponenteId].find(c => c.id === alvoId);
    if (!cartaAtacante || !cartaAlvo || cartaAtacante.exaustao) return;

    if (cartaAtacante.Mecânica && cartaAtacante.Mecânica.includes('Instável')) {
        const matchInstavel = cartaAtacante.Mecânica.match(/\((\d+)\)/);
        if (matchInstavel) {
            const valorInstavel = parseInt(matchInstavel[1], 10) * 10;
            cartaAtacante.Vida -= valorInstavel;
            cartaAlvo.Vida -= valorInstavel;
        }
    }

    if (cartaAtacante.Vida > 0 && cartaAlvo.Vida > 0) {
        cartaAlvo.Vida -= cartaAtacante.Força;
        cartaAtacante.Vida -= cartaAlvo.Força;
    }

    cartaAtacante.exaustao = true;
    moverMortosParaCemiterio(estado, userId);
    moverMortosParaCemiterio(estado, oponenteId);
}

function registrarMapeamentoSocketUsuario(socket, userId) {
    if (!socket || !userId) return;
    const antigoSocketId = userIdParaSocketId[userId];

    if (antigoSocketId && antigoSocketId !== socket.id) {
        delete socketIdParaUserId[antigoSocketId];
    }

    socketIdParaUserId[socket.id] = userId;
    userIdParaSocketId[userId] = socket.id;
}

function limparMapeamentoDoSocket(socketId) {
    const userId = socketIdParaUserId[socketId];
    if (!userId) return;

    delete socketIdParaUserId[socketId];
    if (userIdParaSocketId[userId] === socketId) {
        delete userIdParaSocketId[userId];
    }
}

function encerrarPartida(io, sala, payloadFim) {
    const jogo = jogosAtivos[sala];
    if (!jogo) return;

    if (jogo.reconexaoTimeout) {
        clearTimeout(jogo.reconexaoTimeout);
        jogo.reconexaoTimeout = null;
    }

    io.to(sala).emit('fim_de_jogo', payloadFim);

    Object.keys(jogo.socketIdParaUid).forEach((socketId) => {
        const socketDaSala = io.sockets.sockets.get(socketId);
        if (socketDaSala) {
            socketDaSala.leave(sala);
        }

        limparMapeamentoDoSocket(socketId);
        delete jogo.socketIdParaUid[socketId];
    });

    delete jogosAtivos[sala];
}

function pausarPartidaPorDesconexao(io, sala, socketIdDesconectado) {
    const jogo = jogosAtivos[sala];
    if (!jogo) return;

    const userIdDesconectado = jogo.socketIdParaUid[socketIdDesconectado];
    if (!userIdDesconectado) return;

    const oponenteId = Object.keys(jogo.estado.jogadores).find(id => id !== userIdDesconectado);

    delete jogo.socketIdParaUid[socketIdDesconectado];
    limparMapeamentoDoSocket(socketIdDesconectado);

    jogo.estado.status = 'pausado';
    jogo.desconectadoUserId = userIdDesconectado;

    io.to(sala).emit('fim_de_jogo', {
        motivo: 'partida_pausada',
        sala,
        userIdDesconectado,
        timeoutReconexaoMs: TEMPO_RECONEXAO_MS
    });

    if (jogo.reconexaoTimeout) {
        clearTimeout(jogo.reconexaoTimeout);
    }

    jogo.reconexaoTimeout = setTimeout(() => {
        const jogoAtual = jogosAtivos[sala];
        if (!jogoAtual || jogoAtual.estado.status !== 'pausado' || jogoAtual.desconectadoUserId !== userIdDesconectado) {
            return;
        }

        encerrarPartida(io, sala, {
            motivo: 'desconexao',
            sala,
            vencedor: oponenteId,
            perdedor: userIdDesconectado
        });
    }, TEMPO_RECONEXAO_MS);
}

function obterSalasDoSocket(socketId) {
    return Object.entries(jogosAtivos)
        .filter(([, jogo]) => Boolean(jogo.socketIdParaUid[socketId]))
        .map(([sala]) => sala);
}

function obterUserIdAutenticado(socket) {
    const userIdDoAuth = socket.handshake && socket.handshake.auth && socket.handshake.auth.userId;
    if (typeof userIdDoAuth === 'string' && userIdDoAuth.trim()) {
        return userIdDoAuth;
    }

    const userIdDoSocketData = socket.data && socket.data.userId;
    if (typeof userIdDoSocketData === 'string' && userIdDoSocketData.trim()) {
        return userIdDoSocketData;
    }

    return null;
}

function gerenciarSockets(io, db) {
    io.on('connection', (socket) => {
        console.log(`[CONEXÃO] Jogador conectado: ${socket.id}`);

        socket.on('buscar_partida', async ({ deckId, userId }) => {
            if (!deckId || !userId) return;

            registrarMapeamentoSocketUsuario(socket, userId);

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
                console.log(`[MATCH] Fila tem um jogador. Formando partida...`);
                const { socket: j1Socket, deckId: d1, userId: u1 } = filaDeEspera;
                const { socket: j2Socket, deckId: d2, userId: u2 } = { socket, deckId, userId };
                
                filaDeEspera = null;
                console.log(`[MATCH] Fila esvaziada.`);

                const nomeDaSala = `sala_${j1Socket.id}_${j2Socket.id}`;
                j1Socket.join(nomeDaSala);
                j2Socket.join(nomeDaSala);

                console.log(`[MATCH] Matchmaking! J1(${u1}) vs J2(${u2}) na sala ${nomeDaSala}`);

                try {
                    const estadoInicial = await criarEstadoInicialDoJogo(db, u1, d1, u2, d2);
                    estadoInicial.status = 'em_andamento';

                    const socketMap = { [j1Socket.id]: u1, [j2Socket.id]: u2 };
                    jogosAtivos[nomeDaSala] = {
                        estado: estadoInicial,
                        socketIdParaUid: socketMap,
                        reconexaoTimeout: null,
                        desconectadoUserId: null
                    };

                    registrarMapeamentoSocketUsuario(j1Socket, u1);
                    registrarMapeamentoSocketUsuario(j2Socket, u2);

                    io.to(nomeDaSala).emit('partida_encontrada', { sala: nomeDaSala, estado: estadoInicial });
                    console.log(`[MATCH] Partida criada e enviada com sucesso para a sala ${nomeDaSala}`);
                } catch (error) {
                    console.error('Erro crítico ao criar o estado do jogo:', error);
                    io.to(nomeDaSala).emit('erro_partida', { mensagem: 'Não foi possível carregar os baralhos.' });
                }
            }
        });

        const criarManipuladorDeAcao = (nomeAcao, logicaAcao) => {
            socket.on(nomeAcao, (dados) => {
                const payload = validarPayloadBasico(socket, nomeAcao, dados);
                if (!payload) return;

                const sala = payload.sala;
                const jogo = jogosAtivos[sala];
                if (!jogo || jogo.estado.status === 'pausado') return;

                const userId = jogo.socketIdParaUid[socket.id];
                if (!userId || userId !== jogo.estado.turno) return;

                const acaoValida = logicaAcao(jogo.estado, userId, payload);
                if (acaoValida === false) return;

                const oponenteId = Object.keys(jogo.estado.jogadores).find(id => id !== userId);
                if (jogo.estado.jogadores[oponenteId].vida <= 0) {
                    encerrarPartida(io, sala, { vencedor: userId, motivo: 'vitoria_padrao' });
                } else {
                    io.to(sala).emit('estado_atualizado', jogo.estado);
                }
            });
        };

        criarManipuladorDeAcao('passar_turno', (estado, userId) => {
            const proximoJogadorId = Object.keys(estado.jogadores).find(id => id !== userId);
            const jogadorDoTurno = estado.jogadores[proximoJogadorId];
            if (jogadorDoTurno.baralho.length > 0) jogadorDoTurno.mao.push(jogadorDoTurno.baralho.shift());
            const { geracaoRecursos: geracao, recursosMax: maximo } = jogadorDoTurno;
            jogadorDoTurno.recursos.C = Math.min(jogadorDoTurno.recursos.C + geracao.C, maximo.C);
            jogadorDoTurno.recursos.M = Math.min(jogadorDoTurno.recursos.M + geracao.M, maximo.M);
            jogadorDoTurno.recursos.O = Math.min(jogadorDoTurno.recursos.O + geracao.O, maximo.O);
            jogadorDoTurno.recursos.A = Math.min(jogadorDoTurno.recursos.A + geracao.A, maximo.A);
            estado.campo[proximoJogadorId].forEach(c => c.exaustao = false);
            estado.turno = proximoJogadorId;
        });

        criarManipuladorDeAcao('jogar_carta', (estado, userId, { cartaId }) => {
            const jogador = estado.jogadores[userId];
            const idx = jogador.mao.findIndex(c => c.id === cartaId);
            if (idx === -1) return;
            const carta = jogador.mao[idx];
            if (jogador.recursos.C < carta.C || jogador.recursos.M < carta.M || jogador.recursos.O < carta.O || jogador.recursos.A < carta.A) return;
            jogador.recursos.C -= carta.C;
            jogador.recursos.M -= carta.M;
            jogador.recursos.O -= carta.O;
            jogador.recursos.A -= carta.A;
            jogador.mao.splice(idx, 1);
            carta.exaustao = true;
            estado.campo[userId].push(carta);
        });

        criarManipuladorDeAcao('atacar_fortaleza', (estado, userId, { atacantesIds }) => {
            if (!Array.isArray(atacantesIds)) {
                emitirErroPayloadInvalido(socket, 'atacar_fortaleza', 'O campo "atacantesIds" deve ser um array.');
                return false;
            }

            const oponenteId = Object.keys(estado.jogadores).find(id => id !== userId);
            const oponente = estado.jogadores[oponenteId];
            let danoTotal = 0;
            atacantesIds.forEach(atacanteId => {
                const cartaAtacante = estado.campo[userId].find(c => c.id === atacanteId);
                if (cartaAtacante && cartaAtacante.Força > 0 && !cartaAtacante.exaustao) {
                    danoTotal += cartaAtacante.Força;
                    cartaAtacante.exaustao = true;
                }
            });
            if (danoTotal > 0) { oponente.vida -= danoTotal; }
        });

        criarManipuladorDeAcao('declarar_ataque', (estado, userId, { atacanteId, alvoId }) => {
            const atacanteValido = validarStringObrigatoria(socket, 'declarar_ataque', atacanteId, 'atacanteId');
            const alvoValido = validarStringObrigatoria(socket, 'declarar_ataque', alvoId, 'alvoId');
            if (!atacanteValido || !alvoValido) return false;

            resolverCombateDeclarado(estado, userId, atacanteId, alvoId);
        });

        socket.on('rebind_socket', (dados = {}) => {
            const userIdAutenticado = obterUserIdAutenticado(socket);
            if (!userIdAutenticado) {
                socket.emit('erro_partida', { mensagem: 'Usuário não autenticado para reconexão.' });
                return;
            }

            const sala = typeof dados.sala === 'string' ? dados.sala.trim() : '';
            const userIdPayload = typeof dados.userId === 'string' ? dados.userId.trim() : '';

            if (userIdPayload && userIdPayload !== userIdAutenticado) {
                socket.emit('erro_partida', { mensagem: 'userId do payload difere do usuário autenticado.' });
                return;
            }

            const salaDoJogo = sala || Object.keys(jogosAtivos).find((nomeSala) => {
                const jogo = jogosAtivos[nomeSala];
                return jogo && jogo.desconectadoUserId === userIdAutenticado;
            });

            if (!salaDoJogo || !jogosAtivos[salaDoJogo]) {
                socket.emit('erro_partida', { mensagem: 'Não há partida pausada para reconexão.' });
                return;
            }

            const jogo = jogosAtivos[salaDoJogo];
            if (jogo.desconectadoUserId !== userIdAutenticado) {
                socket.emit('erro_partida', { mensagem: 'Este usuário não está pendente de reconexão nesta sala.' });
                return;
            }

            registrarMapeamentoSocketUsuario(socket, userIdAutenticado);
            jogo.socketIdParaUid[socket.id] = userIdAutenticado;
            socket.join(salaDoJogo);

            jogo.desconectadoUserId = null;
            jogo.estado.status = 'em_andamento';

            if (jogo.reconexaoTimeout) {
                clearTimeout(jogo.reconexaoTimeout);
                jogo.reconexaoTimeout = null;
            }

            io.to(salaDoJogo).emit('estado_atualizado', jogo.estado);
            socket.emit('rebind_confirmado', { sala: salaDoJogo, userId: userIdAutenticado });
        });

        socket.on('disconnect', () => {
            console.log(`[DESCONEXÃO] Jogador desconectado: ${socket.id}`);

            if (filaDeEspera && filaDeEspera.socket.id === socket.id) {
                console.log(`[FILA] O jogador ${filaDeEspera.userId} que estava na fila desconectou.`);
                filaDeEspera = null;
                console.log('[FILA] Fila foi limpa.');
            }

            const salasDoJogador = obterSalasDoSocket(socket.id);
            salasDoJogador.forEach((sala) => pausarPartidaPorDesconexao(io, sala, socket.id));

            limparMapeamentoDoSocket(socket.id);
        });
    });
}

module.exports = gerenciarSockets;
module.exports.__testables = {
    jogosAtivos,
    userIdParaSocketId,
    socketIdParaUserId,
    TEMPO_RECONEXAO_MS,
    obterSalasDoSocket,
    obterUserIdAutenticado,
    encerrarPartida,
    pausarPartidaPorDesconexao,
    registrarMapeamentoSocketUsuario,
    limparMapeamentoDoSocket,
    resolverCombateDeclarado,
    moverMortosParaCemiterio
};
