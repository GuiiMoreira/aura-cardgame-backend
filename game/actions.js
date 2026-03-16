function clonarEstado(estado) {
    return JSON.parse(JSON.stringify(estado));
}

function obterOponenteId(estado, userId) {
    return Object.keys(estado.jogadores).find((id) => id !== userId);
}

function moverMortosParaCemiterio(estado, jogadorId) {
    estado.campo[jogadorId] = estado.campo[jogadorId].filter((carta) => {
        if (carta.Vida <= 0) {
            estado.jogadores[jogadorId].cemiterio.push(carta);
            return false;
        }
        return true;
    });
}

function calcularCusto(carta, recurso) {
    return Number(carta[recurso] || 0);
}

function passarTurno(estadoAtual, userId) {
    const estado = clonarEstado(estadoAtual);
    const proximoJogadorId = obterOponenteId(estado, userId);
    if (!proximoJogadorId) {
        return { ok: false, motivo: 'oponente_invalido' };
    }

    const jogadorDoTurno = estado.jogadores[proximoJogadorId];

    if (jogadorDoTurno.baralho.length > 0) {
        jogadorDoTurno.mao.push(jogadorDoTurno.baralho.shift());
    }

    const { geracaoRecursos: geracao, recursosMax: maximo } = jogadorDoTurno;
    jogadorDoTurno.recursos.C = Math.min(jogadorDoTurno.recursos.C + geracao.C, maximo.C);
    jogadorDoTurno.recursos.M = Math.min(jogadorDoTurno.recursos.M + geracao.M, maximo.M);
    jogadorDoTurno.recursos.O = Math.min(jogadorDoTurno.recursos.O + geracao.O, maximo.O);
    jogadorDoTurno.recursos.A = Math.min(jogadorDoTurno.recursos.A + geracao.A, maximo.A);

    estado.campo[proximoJogadorId].forEach((carta) => {
        carta.exaustao = false;
    });

    estado.turno = proximoJogadorId;
    return { ok: true, estado };
}

function jogarCarta(estadoAtual, userId, cartaId) {
    const estado = clonarEstado(estadoAtual);
    const jogador = estado.jogadores[userId];
    const idx = jogador.mao.findIndex((carta) => carta.id === cartaId);

    if (idx === -1) {
        return { ok: false, motivo: 'carta_nao_encontrada' };
    }

    const carta = jogador.mao[idx];
    const recursos = jogador.recursos;

    const custoC = calcularCusto(carta, 'C');
    const custoM = calcularCusto(carta, 'M');
    const custoO = calcularCusto(carta, 'O');
    const custoA = calcularCusto(carta, 'A');

    if (recursos.C < custoC || recursos.M < custoM || recursos.O < custoO || recursos.A < custoA) {
        return { ok: false, motivo: 'recursos_insuficientes' };
    }

    recursos.C -= custoC;
    recursos.M -= custoM;
    recursos.O -= custoO;
    recursos.A -= custoA;

    jogador.mao.splice(idx, 1);
    carta.exaustao = true;
    estado.campo[userId].push(carta);

    return { ok: true, estado };
}

function atacarFortaleza(estadoAtual, userId, atacantesIds = []) {
    const estado = clonarEstado(estadoAtual);
    const oponenteId = obterOponenteId(estado, userId);
    const oponente = estado.jogadores[oponenteId];

    let danoTotal = 0;

    atacantesIds.forEach((atacanteId) => {
        const cartaAtacante = estado.campo[userId].find((carta) => carta.id === atacanteId);
        if (!cartaAtacante || cartaAtacante.exaustao || cartaAtacante.Força <= 0) {
            return;
        }

        danoTotal += cartaAtacante.Força;
        cartaAtacante.exaustao = true;
    });

    if (danoTotal > 0) {
        oponente.vida -= danoTotal;
    }

    return {
        ok: true,
        estado,
        fimDeJogo: oponente.vida <= 0,
        vencedor: oponente.vida <= 0 ? userId : null
    };
}

function declararAtaque(estadoAtual, userId, atacanteId, alvoId) {
    const estado = clonarEstado(estadoAtual);
    const oponenteId = obterOponenteId(estado, userId);

    const cartaAtacante = estado.campo[userId].find((carta) => carta.id === atacanteId);
    const cartaAlvo = estado.campo[oponenteId].find((carta) => carta.id === alvoId);

    if (!cartaAtacante || !cartaAlvo || cartaAtacante.exaustao) {
        return { ok: false, motivo: 'ataque_invalido' };
    }

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

    return { ok: true, estado };
}

module.exports = {
    passarTurno,
    jogarCarta,
    atacarFortaleza,
    declararAtaque,
    moverMortosParaCemiterio
};
