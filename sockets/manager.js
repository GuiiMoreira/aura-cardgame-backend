const { criarEstadoInicialDoJogo } = require('../game/logic');

const jogosAtivos = {};
let filaDeEspera = null;

function gerenciarSockets(io, db) {
     io.on('connection', (socket) => {
        console.log(`[CONEXÃO] Jogador conectado: ${socket.id}`);

        socket.on('buscar_partida', async ({ deckId, userId }) => {
            if (!deckId || !userId) { return; }
            
            if (filaDeEspera && filaDeEspera.socket.id === socket.id) { return; }
            
            console.log(`[FILA] Jogador ${userId} (socket ${socket.id}) entrou na busca com o baralho ${deckId}`);

            if (!filaDeEspera) {
                filaDeEspera = { socket, deckId, userId };
                socket.emit('status_matchmaking', 'Você está na fila...');
            } else {
                const jogador1 = filaDeEspera.socket;
                const deckId1 = filaDeEspera.deckId;
                const userId1 = filaDeEspera.userId;
                
                const jogador2 = socket;
                const deckId2 = deckId;
                const userId2 = userId;

                filaDeEspera = null;

                const nomeDaSala = `sala_${jogador1.id}_${jogador2.id}`;
                jogador1.join(nomeDaSala);
                jogador2.join(nomeDaSala);

                console.log(`[MATCH] Matchmaking! J1(${userId1}) vs J2(${userId2})`);

                try {
                    // Passamos os UIDs para a lógica do jogo, não mais os socket.ids
                    const estadoInicial = await criarEstadoInicialDoJogo(db, userId1, deckId1, userId2, deckId2);
                    jogosAtivos[nomeDaSala] = estadoInicial;
                    io.to(nomeDaSala).emit('partida_encontrada', { sala: nomeDaSala, estado: estadoInicial });
                } catch (error) {
                    console.error("Erro crítico ao criar o estado do jogo:", error);
                }
            }
        });

        socket.on('disconnect', () => {
            console.log(`[DESCONEXÃO] Jogador desconectado: ${socket.id}`);
            if (filaDeEspera && filaDeEspera.socket.id === socket.id) {
                filaDeEspera = null;
                console.log(`[FILA] Jogador da fila desconectou. Fila foi limpa.`);
            }
        });

        socket.on('passar_turno', ({ sala }) => {
            const estadoAtual = jogosAtivos[sala];
            if (!estadoAtual || socket.id !== estadoAtual.turno) return;
            const jogadorAtualId = estadoAtual.turno;
            const idsJogadores = Object.keys(estadoAtual.jogadores);
            const proximoJogadorId = idsJogadores.find(id => id !== jogadorAtualId);
            const jogadorDoTurno = estadoAtual.jogadores[proximoJogadorId];
            if (jogadorDoTurno.baralho.length > 0) {
                jogadorDoTurno.mao.push(jogadorDoTurno.baralho.shift());
            }
            const geracao = jogadorDoTurno.geracaoRecursos;
            const maximo = jogadorDoTurno.recursosMax;
            jogadorDoTurno.recursos.C = Math.min(jogadorDoTurno.recursos.C + geracao.C, maximo.C);
            jogadorDoTurno.recursos.M = Math.min(jogadorDoTurno.recursos.M + geracao.M, maximo.M);
            jogadorDoTurno.recursos.O = Math.min(jogadorDoTurno.recursos.O + geracao.O, maximo.O);
            jogadorDoTurno.recursos.A = Math.min(jogadorDoTurno.recursos.A + geracao.A, maximo.A);
            estadoAtual.campo[proximoJogadorId].forEach(criatura => criatura.exaustao = false);
            estadoAtual.turno = proximoJogadorId;
            io.to(sala).emit('estado_atualizado', estadoAtual);
        });

        socket.on('jogar_carta', ({ sala, cartaId }) => {
            const estado = jogosAtivos[sala];
            if (!estado || socket.id !== estado.turno) return;
            const jogadorId = estado.turno;
            const jogador = estado.jogadores[jogadorId];
            const indiceCartaNaMao = jogador.mao.findIndex(c => c.id === cartaId);
            if (indiceCartaNaMao === -1) return;
            const cartaJogada = jogador.mao[indiceCartaNaMao];
            if (jogador.recursos.C < cartaJogada.C || jogador.recursos.M < cartaJogada.M || jogador.recursos.O < cartaJogada.O || jogador.recursos.A < cartaJogada.A) { return; }
            jogador.recursos.C -= cartaJogada.C;
            jogador.recursos.M -= cartaJogada.M;
            jogador.recursos.O -= cartaJogada.O;
            jogador.recursos.A -= cartaJogada.A;
            jogador.mao.splice(indiceCartaNaMao, 1);
            cartaJogada.exaustao = true;
            estado.campo[jogadorId].push(cartaJogada);
            io.to(sala).emit('estado_atualizado', estado);
        });

        socket.on('atacar_fortaleza', ({ sala, atacantesIds }) => {
            const estado = jogosAtivos[sala];
            if (!estado || socket.id !== estado.turno) return;
            const jogadorId = estado.turno;
            const oponenteId = Object.keys(estado.jogadores).find(id => id !== jogadorId);
            const oponente = estado.jogadores[oponenteId];
            let danoTotal = 0;
            atacantesIds.forEach(atacanteId => {
                const cartaAtacante = estado.campo[jogadorId].find(c => c.id === atacanteId);
                if (cartaAtacante && cartaAtacante.Força > 0 && !cartaAtacante.exaustao) {
                    danoTotal += cartaAtacante.Força;
                    cartaAtacante.exaustao = true;
                }
            });
            if (danoTotal > 0) {
                oponente.vida -= danoTotal;
                if (oponente.vida <= 0) {
                    io.to(sala).emit('fim_de_jogo', { vencedor: jogadorId });
                    delete jogosAtivos[sala];
                    return;
                }
            }
            io.to(sala).emit('estado_atualizado', estado);
        });
        
        socket.on('declarar_ataque', ({ sala, atacanteId, alvoId }) => {
            const estado = jogosAtivos[sala];
            if (!estado || socket.id !== estado.turno) return;
            const jogadorId = estado.turno;
            const oponenteId = Object.keys(estado.jogadores).find(id => id !== jogadorId);
            const cartaAtacante = estado.campo[jogadorId].find(c => c.id === atacanteId);
            const cartaAlvo = estado.campo[oponenteId].find(c => c.id === alvoId);
            if (!cartaAtacante || !cartaAlvo || cartaAtacante.exaustao) return;
            if (cartaAtacante.Mecânica && cartaAtacante.Mecânica.includes('Instável')) {
                const valorInstavel = parseInt(cartaAtacante.Mecânica.match(/\((\d+)\)/)[1]) * 10;
                cartaAtacante.Vida -= valorInstavel;
                cartaAlvo.Vida -= valorInstavel;
            }
            if (cartaAtacante.Vida > 0 && cartaAlvo.Vida > 0) {
                cartaAlvo.Vida -= cartaAtacante.Força;
                cartaAtacante.Vida -= cartaAlvo.Força;
            }
            cartaAtacante.exaustao = true;
            const campoJogadorAtualizado = [];
            estado.campo[jogadorId].forEach(carta => {
                if (carta.Vida > 0) { campoJogadorAtualizado.push(carta); } 
                else { estado.jogadores[jogadorId].cemiterio.push(carta); }
            });
            estado.campo[jogadorId] = campoJogadorAtualizado;
            const campoOponenteAtualizado = [];
            estado.campo[oponenteId].forEach(carta => {
                if (carta.Vida > 0) { campoOponenteAtualizado.push(carta); } 
                else { estado.jogadores[oponenteId].cemiterio.push(carta); }
            });
            estado.campo[oponenteId] = campoOponenteAtualizado;
            io.to(sala).emit('estado_atualizado', estado);
        });
    });
}

module.exports = gerenciarSockets;
