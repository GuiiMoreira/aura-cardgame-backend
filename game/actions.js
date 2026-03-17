const { runHookForCard } = require('./abilities');
const {
  TURN_PHASES,
  getNextPhase,
  assertActionAllowedInPhase,
} = require('./turn-phases');

function getOponenteId(estado, userId) {
  return Object.keys(estado.jogadores).find((id) => id !== userId);
}

function passarTurno(estado, userId) {
  const proximaFase = getNextPhase(estado.fase);
  estado.fase = proximaFase;

  if (proximaFase !== TURN_PHASES.RITUAL_DE_GERACAO) {
    return;
  }

  const proximoJogadorId = getOponenteId(estado, userId);
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

    runHookForCard(carta, 'onTurnStart', {
      estado,
      userId: proximoJogadorId,
      opponentId: getOponenteId(estado, proximoJogadorId),
    });
  });

  estado.turno = proximoJogadorId;
}

function resolveDeaths(estado, ordemJogadores, context = {}) {
  let houveRemocao = true;

  while (houveRemocao) {
    houveRemocao = false;

    ordemJogadores.forEach((jogadorId) => {
      const cartasDoCampo = estado.campo[jogadorId];
      const sobreviventes = [];

      cartasDoCampo.forEach((carta) => {
        if (carta.Vida > 0) {
          sobreviventes.push(carta);
          return;
        }

        runHookForCard(carta, 'onDeath', {
          estado,
          userId: jogadorId,
          opponentId: getOponenteId(estado, jogadorId),
          ...context,
        });

        estado.jogadores[jogadorId].cemiterio.push(carta);
        houveRemocao = true;
      });

      estado.campo[jogadorId] = sobreviventes;
    });
  }
}

function jogarCarta(estado, userId, cartaId) {
  assertActionAllowedInPhase(estado, 'jogar_carta', [TURN_PHASES.MANIFESTACAO]);

  const jogador = estado.jogadores[userId];
  const idx = jogador.mao.findIndex((carta) => carta.id === cartaId);

  if (idx === -1) return;

  const carta = jogador.mao[idx];
  if (
    jogador.recursos.C < carta.C ||
    jogador.recursos.M < carta.M ||
    jogador.recursos.O < carta.O ||
    jogador.recursos.A < carta.A
  ) {
    return;
  }

  jogador.recursos.C -= carta.C;
  jogador.recursos.M -= carta.M;
  jogador.recursos.O -= carta.O;
  jogador.recursos.A -= carta.A;

  jogador.mao.splice(idx, 1);
  carta.exaustao = true;
  estado.campo[userId].push(carta);

  runHookForCard(carta, 'onSummon', {
    estado,
    userId,
    opponentId: getOponenteId(estado, userId),
  });

  resolveDeaths(estado, [userId, getOponenteId(estado, userId)]);
}

function atacarFortaleza(estado, userId, atacantesIds) {
  assertActionAllowedInPhase(estado, 'atacar_fortaleza', [TURN_PHASES.GUERRA_DOS_VEUS]);

  const oponenteId = getOponenteId(estado, userId);
  const oponente = estado.jogadores[oponenteId];
  let danoTotal = 0;

  atacantesIds.forEach((atacanteId) => {
    const cartaAtacante = estado.campo[userId].find((carta) => carta.id === atacanteId);
    if (cartaAtacante && cartaAtacante.Força > 0 && !cartaAtacante.exaustao) {
      danoTotal += cartaAtacante.Força;
      cartaAtacante.exaustao = true;
    }
  });

  if (danoTotal > 0) {
    oponente.vida -= danoTotal;
  }
}

function declararAtaque(estado, userId, atacanteId, alvoId) {
  assertActionAllowedInPhase(estado, 'declarar_ataque', [TURN_PHASES.GUERRA_DOS_VEUS]);

  const oponenteId = getOponenteId(estado, userId);
  const cartaAtacante = estado.campo[userId].find((carta) => carta.id === atacanteId);
  const cartaAlvo = estado.campo[oponenteId].find((carta) => carta.id === alvoId);

  if (!cartaAtacante || !cartaAlvo || cartaAtacante.exaustao) {
    return;
  }

  runHookForCard(cartaAtacante, 'beforeAttack', {
    estado,
    userId,
    opponentId: oponenteId,
    targetCard: cartaAlvo,
  });

  runHookForCard(cartaAlvo, 'beforeAttack', {
    estado,
    userId: oponenteId,
    opponentId: userId,
    targetCard: cartaAtacante,
  });

  if (cartaAtacante.Vida > 0 && cartaAlvo.Vida > 0) {
    cartaAlvo.Vida -= cartaAtacante.Força;
    cartaAtacante.Vida -= cartaAlvo.Força;
  }

  runHookForCard(cartaAtacante, 'afterAttack', {
    estado,
    userId,
    opponentId: oponenteId,
    targetCard: cartaAlvo,
  });

  runHookForCard(cartaAlvo, 'afterAttack', {
    estado,
    userId: oponenteId,
    opponentId: userId,
    targetCard: cartaAtacante,
  });

  cartaAtacante.exaustao = true;

  resolveDeaths(estado, [userId, oponenteId], {
    atacanteId,
    alvoId,
  });
}

module.exports = {
  passarTurno,
  jogarCarta,
  atacarFortaleza,
  declararAtaque,
};
