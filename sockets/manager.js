const { criarEstadoInicialDoJogo } = require('../game/logic');

const jogosAtivos = {};
let filaDeEspera = null;

function gerenciarSockets(io, db) {
    io.on('connection', (socket) => {
        console.log(`[CONEXÃO] Jogador conectado: ${socket.id}`);

        socket.on('buscar_partida', async ({ deckId, userId }) => {
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
                console.log(`[MATCH] Fila tem um jogador. Formando partida...`);
                const { socket: j1Socket, deckId: d1, userId: u1 } = filaDeEspera;
                const { socket: j2Socket, deckId: d2, userId: u2 } = { socket, deckId, userId };
                
                // Limpa a fila IMEDIATAMENTE para evitar que outros jogadores entrem na mesma partida
                filaDeEspera = null;
                console.log(`[MATCH] Fila esvaziada.`);

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
                    console.error("Erro crítico ao criar o estado do jogo:", error);
                    io.to(nomeDaSala).emit('erro_partida', { mensagem: 'Não foi possível carregar os baralhos.' });
                }
            }
        });

        const criarManipuladorDeAcao = (nomeAcao, logicaAcao) => {
             socket.on(nomeAcao, (dados) => {
                const sala = dados.sala;
                const jogo = jogosAtivos[sala];
                if (!jogo) return;
                const userId = jogo.socketIdParaUid[socket.id];
                if (!userId || userId !== jogo.estado.turno) return;
                logicaAcao(jogo.estado, userId, dados);
                const oponenteId = Object.keys(jogo.estado.jogadores).find(id => id !== userId);
                if (jogo.estado.jogadores[oponenteId].vida <= 0) {
                    io.to(sala).emit('fim_de_jogo', { vencedor: userId });
                    delete jogosAtivos[sala];
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
            const oponenteId = Object.keys(estado.jogadores).find(id => id !== userId);
            const cartaAtacante = estado.campo[userId].find(c => c.id === atacanteId);
            const cartaAlvo = estado.campo[oponenteId].find(c => c.id === alvoId);
            if (!cartaAtacante || !cartaAlvo || cartaAtacante.exaustao) return;
            if (cartaAtacante.Mecânica && cartaAtacante.Mecânica.includes('Instável')) {
                const valorInstavel = parseInt(cartaAtacante.Mecânica.match(/\((\d+)\)/)[1]) * 10;
                cartaAtacante.Vida -= valorInstavel;
                cartaAlvo.Vida -= valorInstavel;
            }
            if (cartaAtacante.Vida > 0 && cartaAlvo.Vida > 0) {
                cartaAlvo.Vida -= cartaAtacante.Força;
                cartaAtacante.Vida -= cartaAtacante.Força;
            }
            cartaAtacante.exaustao = true;
            estado.campo[userId] = estado.campo[userId].filter(c => {
                if (c.Vida <= 0) { estado.jogadores[userId].cemiterio.push(c); return false; }
                return true;
            });
            estado.campo[oponenteId] = estado.campo[oponenteId].filter(c => {
                if (c.Vida <= 0) { estado.jogadores[oponenteId].cemiterio.push(c); return false; }
                return true;
            });
        });

        socket.on('disconnect', () => {
            console.log(`[DESCONEXÃO] Jogador desconectado: ${socket.id}`);
            if (filaDeEspera && filaDeEspera.socket.id === socket.id) {
                console.log(`[FILA] O jogador ${filaDeEspera.userId} que estava na fila desconectou.`);
                filaDeEspera = null;
                console.log(`[FILA] Fila foi limpa.`);
            }
        });
    });
}

module.exports = gerenciarSockets;
