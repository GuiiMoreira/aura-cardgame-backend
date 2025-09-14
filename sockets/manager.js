const { criarEstadoInicialDoJogo } = require('../game/logic');

const jogosAtivos = {};
let filaDeEspera = null;

function gerenciarSockets(io, db) {
    io.on('connection', (socket) => {
        console.log(`[CONEXÃO] Jogador conectado: ${socket.id}`);

        socket.on('buscar_partida', async ({ deckId, userId }) => {
            if (!deckId || !userId) { return; }
            if (filaDeEspera && filaDeEspera.userId === userId) {
                return; // Impede o mesmo usuário de entrar na fila duas vezes
            }
            console.log(`[FILA] Jogador ${userId} (socket ${socket.id}) entrou na busca com o baralho ${deckId}`);

            if (!filaDeEspera) {
                filaDeEspera = { socket, deckId, userId };
                socket.emit('status_matchmaking', 'Você está na fila, aguardando outro jogador...');
            } else {
                const { socket: jogador1Socket, deckId: deckId1, userId: userId1 } = filaDeEspera;
                const { socket: jogador2Socket, deckId: deckId2, userId: userId2 } = { socket, deckId, userId };
                filaDeEspera = null;

                const nomeDaSala = `sala_${jogador1Socket.id}_${jogador2Socket.id}`;
                jogador1Socket.join(nomeDaSala);
                jogador2Socket.join(nomeDaSala);

                console.log(`[MATCH] Matchmaking! J1(${userId1}) vs J2(${userId2})`);

                try {
                    const estadoInicial = await criarEstadoInicialDoJogo(db, userId1, deckId1, userId2, deckId2);
                    
                    // Mapa que liga o ID temporário do socket ao ID permanente do usuário
                    const socketIdParaUid = {
                        [jogador1Socket.id]: userId1,
                        [jogador2Socket.id]: userId2,
                    };
                    
                    jogosAtivos[nomeDaSala] = { estado: estadoInicial, socketIdParaUid };
                    
                    io.to(nomeDaSala).emit('partida_encontrada', { sala: nomeDaSala, estado: estadoInicial });
                } catch (error) {
                    console.error("Erro crítico ao criar o estado do jogo:", error);
                }
            }
        });

        // Valida e executa uma ação de jogo
        const criarManipuladorDeAcao = (nomeAcao, logicaAcao) => {
            socket.on(nomeAcao, (dados) => {
                const sala = dados.sala;
                const jogo = jogosAtivos[sala];
                if (!jogo) return;

                const userId = jogo.socketIdParaUid[socket.id]; // Descobre quem é o jogador pelo socket.id
                
                // Validação de turno
                if (!userId || userId !== jogo.estado.turno) {
                    console.log(`Ação '${nomeAcao}' inválida. Não é o turno do jogador ${userId}.`);
                    return;
                }
                
                // Executa a lógica específica da ação
                logicaAcao(jogo.estado, userId, dados);
                
                const oponenteId = Object.keys(jogo.estado.jogadores).find(id => id !== userId);

                // Após a ação, verifica se o jogo acabou
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
            if (danoTotal > 0) {
                oponente.vida -= danoTotal;
            }
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
                filaDeEspera = null;
                console.log(`[FILA] Jogador da fila desconectou. Fila foi limpa.`);
            }
            // Adicionar lógica futura para lidar com desconexão em jogo
        });
    });
}

module.exports = gerenciarSockets;
