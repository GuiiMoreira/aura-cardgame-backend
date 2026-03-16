const test = require('node:test');
const assert = require('node:assert/strict');

const { declararAtaque, jogarCarta } = require('../game/actions');

function criarEstadoBase() {
  return {
    jogadores: {
      p1: {
        vida: 100,
        recursos: { C: 20, M: 20, O: 20, A: 20 },
        recursosMax: { C: 60, M: 60, O: 60, A: 60 },
        geracaoRecursos: { C: 10, M: 10, O: 10, A: 10 },
        mao: [],
        baralho: [],
        cemiterio: [],
      },
      p2: {
        vida: 100,
        recursos: { C: 20, M: 20, O: 20, A: 20 },
        recursosMax: { C: 60, M: 60, O: 60, A: 60 },
        geracaoRecursos: { C: 10, M: 10, O: 10, A: 10 },
        mao: [],
        baralho: [],
        cemiterio: [],
      },
    },
    turno: 'p1',
    campo: { p1: [], p2: [] },
  };
}

test('IMPACTO ativa no onSummon ao jogar carta', () => {
  const estado = criarEstadoBase();
  estado.jogadores.p1.mao.push({
    id: 'invocador',
    C: 0,
    M: 0,
    O: 0,
    A: 0,
    Força: 1,
    Vida: 5,
    habilidades: [{ tipo: 'IMPACTO', valor: 7 }],
  });

  jogarCarta(estado, 'p1', 'invocador');

  assert.equal(estado.jogadores.p2.vida, 93);
});

test('ULTIMO_SUSPIRO ativa no onDeath com ordem de resolução previsível', () => {
  const estado = criarEstadoBase();
  estado.campo.p1.push({
    id: 'atk',
    Força: 30,
    Vida: 10,
    exaustao: false,
    habilidades: [{ tipo: 'ULTIMO_SUSPIRO', valor: 4 }],
  });
  estado.campo.p2.push({
    id: 'def',
    Força: 20,
    Vida: 10,
    exaustao: false,
    habilidades: [{ tipo: 'ULTIMO_SUSPIRO', valor: 6 }],
  });

  declararAtaque(estado, 'p1', 'atk', 'def');

  assert.equal(estado.jogadores.p2.vida, 96);
  assert.equal(estado.jogadores.p1.vida, 94);
  assert.deepEqual(estado.jogadores.p1.cemiterio.map((c) => c.id), ['atk']);
  assert.deepEqual(estado.jogadores.p2.cemiterio.map((c) => c.id), ['def']);
});
