const HOOKS = ['onSummon', 'beforeAttack', 'afterAttack', 'onDeath', 'onTurnStart'];

const abilityRegistry = {
  INSTAVEL: {
    beforeAttack: ({ sourceCard, targetCard, ability }) => {
      const dano = ability.params.valor * 10;
      if (dano <= 0 || !sourceCard || !targetCard) return;

      sourceCard.Vida -= dano;
      targetCard.Vida -= dano;
    },
  },
  IMPACTO: {
    onSummon: ({ estado, opponentId, ability }) => {
      const dano = ability.params.valor;
      if (dano <= 0 || !opponentId) return;

      estado.jogadores[opponentId].vida -= dano;
    },
  },
  ULTIMO_SUSPIRO: {
    onDeath: ({ estado, opponentId, ability }) => {
      const dano = ability.params.valor;
      if (dano <= 0 || !opponentId) return;

      estado.jogadores[opponentId].vida -= dano;
    },
  },
  REGENERACAO: {
    onTurnStart: ({ sourceCard, ability }) => {
      const cura = ability.params.valor;
      if (cura <= 0 || !sourceCard) return;

      sourceCard.Vida += cura;
    },
  },
};

function normalizeAbility(rawAbility, index) {
  if (!rawAbility || typeof rawAbility !== 'object') {
    return null;
  }

  const tipo = typeof rawAbility.tipo === 'string' ? rawAbility.tipo.trim().toUpperCase() : '';
  if (!tipo) {
    return null;
  }

  const valorBruto = rawAbility.params?.valor ?? rawAbility.valor ?? 0;
  const valor = Number(valorBruto);
  const prioridadeBruta = rawAbility.prioridade ?? 0;
  const prioridade = Number(prioridadeBruta);

  return {
    tipo,
    prioridade: Number.isFinite(prioridade) ? prioridade : 0,
    sourceIndex: index,
    params: {
      valor: Number.isFinite(valor) ? valor : 0,
    },
  };
}

function getAbilitiesFromCard(card = {}) {
  if (!Array.isArray(card.habilidades)) {
    return [];
  }

  return card.habilidades
    .map((ability, index) => normalizeAbility(ability, index))
    .filter(Boolean);
}

function sortAbilities(abilities) {
  return [...abilities].sort((a, b) => {
    if (a.prioridade !== b.prioridade) {
      return b.prioridade - a.prioridade;
    }

    return a.sourceIndex - b.sourceIndex;
  });
}

function runHookForCard(card, hook, context) {
  if (!HOOKS.includes(hook)) {
    return;
  }

  const abilities = sortAbilities(getAbilitiesFromCard(card));

  abilities.forEach((ability) => {
    const implementation = abilityRegistry[ability.tipo];
    const handler = implementation?.[hook];

    if (typeof handler === 'function') {
      handler({
        ...context,
        ability,
        sourceCard: card,
      });
    }
  });
}

module.exports = {
  HOOKS,
  abilityRegistry,
  getAbilitiesFromCard,
  runHookForCard,
};
