const HOOKS = ['onSummon', 'beforeAttack', 'afterAttack', 'onDeath', 'onTurnStart', 'onActivate'];

const abilityRegistry = {
  INSTAVEL: {
    beforeAttack: ({ sourceCard, targetCard, ability }) => {
      const dano = ability.params.valor * 10;
      if (dano <= 0 || !sourceCard || !targetCard) return;

      sourceCard.Vida -= dano;
      targetCard.Vida -= dano;
    },
  },
  RECARREGAVEL: {
    onTurnStart: ({ sourceCard }) => {
      if (!sourceCard) return;
      if (typeof sourceCard.turnosRecarga !== 'number' || sourceCard.turnosRecarga <= 0) return;
      sourceCard.turnosRecarga -= 1;
    },
  },
  IMPACTO: {
    onSummon: ({ estado, opponentId, ability }) => {
      const dano = ability.params.valor;
      if (dano <= 0 || !opponentId) return;

      estado.jogadores[opponentId].vida -= dano;
    },
  },
  SACRIFICIO: {
    onSummon: ({ sourceCard, ability }) => {
      const perdaVida = ability.params.valor;
      if (perdaVida <= 0 || !sourceCard) return;

      sourceCard.Vida -= perdaVida;
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
  ALQUIMIA: {
    onActivate: ({ estado, userId, ability }) => {
      const cura = ability.params.valor;
      if (cura <= 0 || !estado?.jogadores?.[userId]) return;

      estado.jogadores[userId].vida += cura;
    },
  },
};

const ALIAS_BY_LABEL = {
  INSTAVEL: 'INSTAVEL',
  IMPACTO: 'IMPACTO',
  SACRIFICIO: 'SACRIFICIO',
  SACRIFÍCIO: 'SACRIFICIO',
  REGENERACAO: 'REGENERACAO',
  'ÚLTIMO SUSPIRO': 'ULTIMO_SUSPIRO',
  'ULTIMO SUSPIRO': 'ULTIMO_SUSPIRO',
  RECARREGAVEL: 'RECARREGAVEL',
  RECARREGÁVEL: 'RECARREGAVEL',
  ALQUIMIA: 'ALQUIMIA',
};

function normalizeAbility(rawAbility, index = 0) {
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

function parseTextualMechanics(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return [];
  }

  const blocos = text
    .split(/[;,|]+/)
    .map((bloco) => bloco.trim())
    .filter(Boolean);

  return blocos
    .map((bloco, sourceIndex) => {
      const match = bloco.match(/^([\p{L}\s_]+?)(?:\s*\(([-+]?\d+)\))?$/u);
      if (!match) {
        return null;
      }

      const rawLabel = match[1].trim().replace(/\s+/g, ' ').toUpperCase();
      const tipo = ALIAS_BY_LABEL[rawLabel];
      if (!tipo) {
        return null;
      }

      const valor = match[2] ? Number(match[2]) : 0;

      return normalizeAbility(
        {
          tipo,
          params: { valor: Number.isFinite(valor) ? valor : 0 },
          prioridade: 0,
        },
        sourceIndex
      );
    })
    .filter(Boolean);
}

function getAbilitiesFromCard(card = {}) {
  if (Array.isArray(card.habilidades) && card.habilidades.length > 0) {
    return card.habilidades
      .map((ability, index) => normalizeAbility(ability, index))
      .filter(Boolean);
  }

  return parseTextualMechanics(card['Mecânica'] ?? card.Mecanica);
}

function normalizeCardAbilities(card = {}) {
  const habilidades = getAbilitiesFromCard(card);

  return {
    ...card,
    habilidades,
  };
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
  normalizeAbility,
  parseTextualMechanics,
  getAbilitiesFromCard,
  normalizeCardAbilities,
  runHookForCard,
};
