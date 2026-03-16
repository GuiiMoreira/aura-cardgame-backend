const abilityRegistry = {
  INSTAVEL: {
    beforeAttack: ({ sourceCard, targetCard, ability }) => {
      const valor = Number(ability.valor) || 0;
      const dano = valor * 10;
      if (dano <= 0 || !sourceCard || !targetCard) return;

      sourceCard.Vida -= dano;
      targetCard.Vida -= dano;
    },
  },
  IMPACTO: {
    onSummon: ({ estado, opponentId, ability }) => {
      const valor = Number(ability.valor) || 0;
      if (valor <= 0 || !opponentId) return;

      estado.jogadores[opponentId].vida -= valor;
    },
  },
  ULTIMO_SUSPIRO: {
    onDeath: ({ estado, opponentId, ability }) => {
      const valor = Number(ability.valor) || 0;
      if (valor <= 0 || !opponentId) return;

      estado.jogadores[opponentId].vida -= valor;
    },
  },
};

function getAbilitiesFromCard(card = {}) {
  if (!Array.isArray(card.habilidades)) {
    return [];
  }

  return card.habilidades
    .map((ability) => {
      if (!ability || typeof ability !== 'object') return null;
      const tipo = typeof ability.tipo === 'string' ? ability.tipo.trim().toUpperCase() : null;
      if (!tipo) return null;
      return {
        tipo,
        valor: ability.valor,
      };
    })
    .filter(Boolean);
}

function runHookForCard(card, hook, context) {
  const abilities = getAbilitiesFromCard(card);

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
  abilityRegistry,
  getAbilitiesFromCard,
  runHookForCard,
};
