const { logger } = require('../logger');

const HOOKS = [
  'onSummon',
  'beforeAttack',
  'beforeEffectResolve',
  'afterAttack',
  'onDeath',
  'onTurnStart',
  'onActivate',
  'onSpellCast',
];


function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function getSacrificioSpec(card = {}, ability = {}) {
  const descricao = normalizeText(card.DescricaoMecanica ?? card.descricaoMecanica);
  const valor = Math.max(0, Number(ability?.params?.valor) || 0);

  if (descricao.includes('si e mais dois ali')) {
    return { totalSacrificios: 3, aliadosNecessarios: 2 };
  }

  if (descricao.includes('si e um aliado')) {
    return { totalSacrificios: 2, aliadosNecessarios: 1 };
  }

  if (descricao.includes('sacrifique-se') || descricao.includes('sacrifique o invocador')) {
    return { totalSacrificios: 1, aliadosNecessarios: 0 };
  }

  return {
    totalSacrificios: valor > 0 ? valor : 1,
    aliadosNecessarios: 0,
  };
}

const abilityRegistry = {
  INSTAVEL: {
    beforeAttack: ({ sourceCard, targetCard, ability, applyEffect }) => {
      const dano = ability.params.valor * 10;
      if (dano <= 0 || !sourceCard || !targetCard) return;

      if (typeof applyEffect === 'function') {
        applyEffect({
          sourceCard,
          targetCard: sourceCard,
          tipo: 'MAGICO',
          natureza: 'DANO',
          valor: dano,
        });
        applyEffect({
          sourceCard,
          targetCard,
          tipo: 'MAGICO',
          natureza: 'DANO',
          valor: dano,
        });
        return;
      }

      sourceCard.Vida -= dano;
      targetCard.Vida -= dano;
    },
  },
  ANTIMAGIA: {
    onSummon: ({ sourceCard, ability }) => {
      if (!sourceCard) return;

      const valor = Math.max(0, Number(ability.params.valor) || 0);
      sourceCard.antimagia = {
        usosRestantes: valor,
      };
    },
    onTurnStart: ({ sourceCard, ability }) => {
      if (!sourceCard) return;

      const valor = Math.max(0, Number(ability.params.valor) || 0);
      sourceCard.antimagia = {
        usosRestantes: valor,
      };
    },
    beforeEffectResolve: ({ sourceCard, ability, effect }) => {
      if (!sourceCard || !effect || effect.tipo !== 'MAGICO' || effect.valor <= 0) return;

      const valor = Math.max(0, Number(ability.params.valor) || 0);
      if (valor <= 0) return;

      if (!sourceCard.antimagia || typeof sourceCard.antimagia.usosRestantes !== 'number') {
        sourceCard.antimagia = { usosRestantes: valor };
      }

      if (sourceCard.antimagia.usosRestantes <= 0) {
        return;
      }

      const reducao = valor * 10;
      effect.valor = Math.max(0, effect.valor - reducao);
      sourceCard.antimagia.usosRestantes -= 1;
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
    onSummon: ({ sourceCard, ability, sacrificeAllyCards }) => {
      if (!sourceCard) return;

      const { aliadosNecessarios } = getSacrificioSpec(sourceCard, ability);
      sourceCard.Vida = 0;

      if (aliadosNecessarios <= 0 || !Array.isArray(sacrificeAllyCards)) {
        return;
      }

      sacrificeAllyCards.slice(0, aliadosNecessarios).forEach((allyCard) => {
        if (allyCard) {
          allyCard.Vida = 0;
        }
      });
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
  RESIDUO_AURICO: {
    onSummon: ({ sourceCard }) => {
      if (!sourceCard) return;
      if (!Number.isFinite(sourceCard.residuosAuricos)) {
        sourceCard.residuosAuricos = 0;
      }
    },
    onSpellCast: ({ sourceCard }) => {
      if (!sourceCard) return;

      const residuosAtuais = Number.isFinite(sourceCard.residuosAuricos) ? sourceCard.residuosAuricos : 0;
      const residuosAcumulados = residuosAtuais + 1;
      const conversoes = Math.floor(residuosAcumulados / 3);

      sourceCard.residuosAuricos = residuosAcumulados % 3;

      if (conversoes > 0) {
        sourceCard.Força += conversoes * 10;
      }
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
  ANTIMAGIA: 'ANTIMAGIA',
  'ANTI MAGIA': 'ANTIMAGIA',
  RESIDUO_AURICO: 'RESIDUO_AURICO',
  'RESÍDUO ÁURICO': 'RESIDUO_AURICO',
};

const ALIAS_BY_NORMALIZED_LABEL = Object.entries(ALIAS_BY_LABEL).reduce((acc, [label, alias]) => {
  acc[normalizeAbilityLabel(label)] = alias;
  return acc;
}, {});

function normalizeAbilityLabel(label) {
  return normalizeText(label)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
      const match = bloco.match(/^([\p{L}\s_-]+?)(?:\s*\(([-+]?\d+)\)|\s+([-+]?\d+))?$/u);
      if (!match) {
        logger.warn('Mecânica textual inválida ignorada', { bloco });
        return null;
      }

      const normalizedLabel = normalizeAbilityLabel(match[1]);
      const tipo = ALIAS_BY_NORMALIZED_LABEL[normalizedLabel];
      if (!tipo) {
        logger.warn('Mecânica desconhecida ignorada', {
          bloco,
          mecanica: match[1].trim(),
          mecanicaNormalizada: normalizedLabel,
        });
        return null;
      }

      const rawValor = match[2] ?? match[3] ?? 0;
      const valor = Number(rawValor);

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
  getSacrificioSpec,
};
