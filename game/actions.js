const { runHookForCard, getAbilitiesFromCard, getSacrificioSpec } = require('./abilities');
const { TURN_PHASES, getNextPhase, assertActionAllowedInPhase } = require('./turn-phases');

function getOponenteId(estado, userId) {
  return Object.keys(estado.jogadores).find((id) => id !== userId);
}

function aplicarEfeito(estado, effect) {
  if (!effect || !effect.targetCard) {
    return;
  }

  const efeito = {
    tipo: effect.tipo ?? 'FISICO',
    natureza: effect.natureza ?? 'DANO',
    valor: Number.isFinite(Number(effect.valor)) ? Number(effect.valor) : 0,
    sourceCard: effect.sourceCard,
    targetCard: effect.targetCard,
  };

  if (efeito.valor <= 0) {
    return;
  }

  runHookForCard(efeito.targetCard, 'beforeEffectResolve', {
    estado,
    userId: effect.targetOwnerId,
    opponentId: effect.sourceOwnerId,
    sourceCard: effect.sourceCard,
    effect: efeito,
  });

  if (efeito.valor <= 0) {
    return;
  }

  if (efeito.natureza === 'DANO') {
    efeito.targetCard.Vida -= efeito.valor;
    return;
  }

  if (efeito.natureza === 'CURA') {
    efeito.targetCard.Vida += efeito.valor;
  }
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

function canCardAttack(carta) {
  if (!carta) return false;
  if (carta.exaustao) return false;
  if (typeof carta.turnosRecarga === 'number' && carta.turnosRecarga > 0) return false;
  return true;
}

function aplicarRecargaAoAtacar(carta) {
  if (!carta) return;

  const habilidadeRecarregavel = getAbilitiesFromCard(carta).find((habilidade) => habilidade.tipo === 'RECARREGAVEL');
  if (!habilidadeRecarregavel) {
    return;
  }

  const turnosRecarga = Number(habilidadeRecarregavel.params.valor);
  if (!Number.isFinite(turnosRecarga) || turnosRecarga <= 0) {
    return;
  }

  carta.turnosRecarga = turnosRecarga;
}


function resolveSacrificioAllies(estado, userId, cartaInvocada, opcoes = {}) {
  const habilidadeSacrificio = getAbilitiesFromCard(cartaInvocada).find((h) => h.tipo === 'SACRIFICIO');
  if (!habilidadeSacrificio) {
    return { ok: true, allies: [] };
  }

  const { aliadosNecessarios } = getSacrificioSpec(cartaInvocada, habilidadeSacrificio);
  if (aliadosNecessarios <= 0) {
    return { ok: true, allies: [] };
  }

  const candidatos = estado.campo[userId].filter((carta) => carta.id !== cartaInvocada.id);
  const alvoIds = Array.isArray(opcoes.sacrificeAllyIds)
    ? opcoes.sacrificeAllyIds
    : [opcoes.sacrificeAllyId].filter((id) => typeof id === 'string');

  const aliados = alvoIds
    .map((id) => candidatos.find((carta) => carta.id === id))
    .filter(Boolean)
    .filter((carta, index, arr) => arr.findIndex((item) => item.id === carta.id) === index)
    .slice(0, aliadosNecessarios);

  if (aliados.length < aliadosNecessarios) {
    return { ok: false, allies: [] };
  }

  return { ok: true, allies: aliados };
}

function jogarCarta(estado, userId, cartaId, opcoes = {}) {
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

  const sacrificioAllies = resolveSacrificioAllies(estado, userId, carta, opcoes);
  if (!sacrificioAllies.ok) {
    estado.campo[userId].pop();
    jogador.mao.splice(idx, 0, carta);
    jogador.recursos.C += carta.C;
    jogador.recursos.M += carta.M;
    jogador.recursos.O += carta.O;
    jogador.recursos.A += carta.A;
    return;
  }

  runHookForCard(carta, 'onSummon', {
    estado,
    userId,
    opponentId: getOponenteId(estado, userId),
    sacrificeAllyCards: sacrificioAllies.allies,
  });

  resolveDeaths(estado, [userId, getOponenteId(estado, userId)]);
}


function dispararConjuracaoFeitico(estado, userId, contexto = {}) {
  const cartasDoCampo = estado?.campo?.[userId];
  if (!Array.isArray(cartasDoCampo)) {
    return;
  }

  cartasDoCampo.forEach((carta) => {
    runHookForCard(carta, 'onSpellCast', {
      estado,
      userId,
      opponentId: getOponenteId(estado, userId),
      ...contexto,
    });
  });
}

function ativarHabilidadeDaCarta(estado, userId, cartaId, habilidadeTipo) {
  const jogador = estado.jogadores[userId];
  const carta = estado.campo[userId].find((item) => item.id === cartaId);

  if (!jogador || !carta || typeof habilidadeTipo !== 'string') {
    return false;
  }

  const tipoNormalizado = habilidadeTipo.trim().toUpperCase();
  const habilidade = getAbilitiesFromCard(carta).find((item) => item.tipo === tipoNormalizado);

  if (!habilidade) {
    return false;
  }

  const custoCemiterio = habilidade.params.valor;
  if (!Number.isFinite(custoCemiterio) || custoCemiterio <= 0) {
    return false;
  }

  if (jogador.cemiterio.length < custoCemiterio) {
    return false;
  }

  jogador.cemiterio.splice(0, custoCemiterio);

  runHookForCard(carta, 'onActivate', {
    estado,
    userId,
    opponentId: getOponenteId(estado, userId),
  });

  dispararConjuracaoFeitico(estado, userId, {
    sourceCard: carta,
    spellAbilityType: tipoNormalizado,
  });

  resolveDeaths(estado, [userId, getOponenteId(estado, userId)]);
  return true;
}

function atacarFortaleza(estado, userId, atacantesIds) {
  assertActionAllowedInPhase(estado, 'atacar_fortaleza', [TURN_PHASES.GUERRA_DOS_VEUS]);

  const oponenteId = getOponenteId(estado, userId);
  const oponente = estado.jogadores[oponenteId];
  let danoTotal = 0;

  atacantesIds.forEach((atacanteId) => {
    const cartaAtacante = estado.campo[userId].find((carta) => carta.id === atacanteId);
    if (!canCardAttack(cartaAtacante) || cartaAtacante.Força <= 0) {
      return;
    }

    const fortalezaAlvo = { id: `fortaleza-${oponenteId}`, Vida: oponente.vida };

    runHookForCard(cartaAtacante, 'beforeAttack', {
      estado,
      userId,
      opponentId: oponenteId,
      targetCard: fortalezaAlvo,
      applyEffect: (effect) => {
        if (!effect || !effect.targetCard) {
          return;
        }

        if (effect.targetCard.id === cartaAtacante.id) {
          aplicarEfeito(estado, {
            ...effect,
            sourceOwnerId: userId,
            targetOwnerId: userId,
          });
          return;
        }

        const valor = Number(effect.valor) || 0;
        if (valor <= 0) {
          return;
        }

        if ((effect.natureza ?? 'DANO') === 'CURA') {
          oponente.vida += valor;
        } else {
          oponente.vida -= valor;
        }
      },
    });

    if (cartaAtacante.Vida <= 0) {
      return;
    }

    danoTotal += cartaAtacante.Força;

    runHookForCard(cartaAtacante, 'afterAttack', {
      estado,
      userId,
      opponentId: oponenteId,
      targetCard: fortalezaAlvo,
    });

    cartaAtacante.exaustao = true;
    aplicarRecargaAoAtacar(cartaAtacante);
  });

  if (danoTotal > 0) {
    oponente.vida -= danoTotal;
  }

  resolveDeaths(estado, [userId, oponenteId]);
}

function declararAtaque(estado, userId, atacanteId, alvoId) {
  assertActionAllowedInPhase(estado, 'declarar_ataque', [TURN_PHASES.GUERRA_DOS_VEUS]);

  const oponenteId = getOponenteId(estado, userId);
  const cartaAtacante = estado.campo[userId].find((carta) => carta.id === atacanteId);
  const cartaAlvo = estado.campo[oponenteId].find((carta) => carta.id === alvoId);

  if (!canCardAttack(cartaAtacante) || !cartaAlvo) {
    return;
  }

  runHookForCard(cartaAtacante, 'beforeAttack', {
    estado,
    userId,
    opponentId: oponenteId,
    targetCard: cartaAlvo,
    applyEffect: (effect) =>
      aplicarEfeito(estado, {
        ...effect,
        sourceOwnerId: userId,
        targetOwnerId: effect.targetCard?.id === cartaAtacante.id ? userId : oponenteId,
      }),
  });

  runHookForCard(cartaAlvo, 'beforeAttack', {
    estado,
    userId: oponenteId,
    opponentId: userId,
    targetCard: cartaAtacante,
  });

  if (cartaAtacante.Vida > 0 && cartaAlvo.Vida > 0) {
    aplicarEfeito(estado, {
      sourceCard: cartaAtacante,
      targetCard: cartaAlvo,
      sourceOwnerId: userId,
      targetOwnerId: oponenteId,
      tipo: 'FISICO',
      natureza: 'DANO',
      valor: cartaAtacante.Força,
    });
    aplicarEfeito(estado, {
      sourceCard: cartaAlvo,
      targetCard: cartaAtacante,
      sourceOwnerId: oponenteId,
      targetOwnerId: userId,
      tipo: 'FISICO',
      natureza: 'DANO',
      valor: cartaAlvo.Força,
    });
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
  aplicarRecargaAoAtacar(cartaAtacante);

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
  ativarHabilidadeDaCarta,
  aplicarEfeito,
};
