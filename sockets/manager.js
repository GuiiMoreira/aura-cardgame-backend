const { criarEstadoInicialDoJogo } = require('../game/logic');

const jogosAtivos = {};
let filaDeEspera = null;

function gerenciarSockets(io, db) {
    io.on('connection', async (socket) => {
        console.log(`[BACKEND] Um jogador se conectou com o ID: ${socket.id}`);

        if (!filaDeEspera) {
            filaDeEspera = socket;
            socket.emit('status_matchmaking', 'Você está na fila...');
        } else {
            const jogador1 = filaDeEspera;
            const jogador2 = socket;
            filaDeEspera = null;

            const nomeDaSala = `sala_${jogador1.id}_${jogador2.id}`;
            jogador1.join(nomeDaSala);
            jogador2.join(nomeDaSala);

            console.log(`[BACKEND] Matchmaking! Jogador 1 ID: ${jogador1.id}, Jogador 2 ID: ${jogador2.id}`);

            try {
                // CORREÇÃO DEFINITIVA: Garantindo que estamos passando 'jogador2.id'
                const estadoInicial = await criarEstadoInicialDoJogo(db, jogador1.id, jogador2.id);

                console.log('[BACKEND] Estado de jogo criado com as chaves de jogadores:', Object.keys(estadoInicial.jogadores));

                jogosAtivos[nomeDaSala] = estadoInicial;
                io.to(nomeDaSala).emit('partida_encontrada', { sala: nomeDaSala, estado: estadoInicial });

            } catch (error) {
                console.error("Erro crítico ao criar o estado do jogo:", error);
                io.to(nomeDaSala).emit('erro_partida', { mensagem: 'Não foi possível carregar os baralhos.' });
            }
        }

        socket.on('passar_turno', ({ sala }) => {
            const estadoAtual = jogosAtivos[sala];
            if (!estadoAtual || socket.id !== estadoAtual.turno) return;
            // ... (lógica completa do passar_turno)
        });

        socket.on('jogar_carta', ({ sala, cartaId }) => {
            const estado = jogosAtivos[sala];
            if (!estado || socket.id !== estado.turno) return;
            // ... (lógica completa do jogar_carta)
        });

        socket.on('atacar_fortaleza', ({ sala, atacantesIds }) => {
            const estado = jogosAtivos[sala];
            if (!estado || socket.id !== estado.turno) return;
            // ... (lógica completa do atacar_fortaleza)
        });

        socket.on('declarar_ataque', ({ sala, atacanteId, alvoId }) => {
            const estado = jogosAtivos[sala];
            if (!estado || socket.id !== estado.turno) return;
            // ... (lógica completa do declarar_ataque)
        });

        socket.on('disconnect', () => {
            console.log(`Jogador desconectado: ${socket.id}`);
            if (filaDeEspera && filaDeEspera.id === socket.id) {
                filaDeEspera = null;
            }
        });
    });
}

module.exports = gerenciarSockets;