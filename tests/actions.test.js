const test = require('node:test');
const assert = require('node:assert/strict');

const { declararAtaque, atacarFortaleza, jogarCarta } = require('../game/actions');
const { TURN_PHASES } = require('../game/turn-phases');

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
    fase: TURN_PHASES.MANIFESTACAO,
    campo: { p1: [], p2: [] },
  };
}

test('declararAtaque aplica contragolpe da força do alvo (bugfix)', () => {
  const estado = criarEstadoBase();
  estado.fase = TURN_PHASES.GUERRA_DOS_VEUS;
  estado.campo.p1.push({ id: 'a1', Força: 30, Vida: 50, exaustao: false });
  estado.campo.p2.push({ id: 'd1', Força: 10, Vida: 40, exaustao: false });

  declararAtaque(estado, 'p1', 'a1', 'd1');

  assert.equal(estado.campo.p1[0].Vida, 40);
  assert.equal(estado.campo.p2[0].Vida, 10);
  assert.equal(estado.campo.p1[0].exaustao, true);
});

test('declararAtaque com INSTAVEL usa estrutura normalizada de habilidades', () => {
  const estado = criarEstadoBase();
  estado.fase = TURN_PHASES.GUERRA_DOS_VEUS;
  estado.campo.p1.push({
    id: 'a1',
    Força: 20,
    Vida: 50,
    exaustao: false,
    habilidades: [{ tipo: 'INSTAVEL', valor: 2 }],
  });
  estado.campo.p2.push({ id: 'd1', Força: 20, Vida: 40, exaustao: false });

  declararAtaque(estado, 'p1', 'a1', 'd1');

  assert.equal(estado.campo.p1[0].Vida, 10);
  assert.equal(estado.campo.p2.length, 0);
  assert.equal(estado.jogadores.p2.cemiterio[0].id, 'd1');
});

test('atacarFortaleza soma dano de atacantes válidos', () => {
  const estado = criarEstadoBase();
  estado.fase = TURN_PHASES.GUERRA_DOS_VEUS;
  estado.campo.p1.push({ id: 'a1', Força: 15, Vida: 20, exaustao: false });
  estado.campo.p1.push({ id: 'a2', Força: 25, Vida: 20, exaustao: true });

  atacarFortaleza(estado, 'p1', ['a1', 'a2']);

  assert.equal(estado.jogadores.p2.vida, 85);
  assert.equal(estado.campo.p1[0].exaustao, true);
});

test('jogarCarta consome recursos e coloca carta exausta no campo', () => {
  const estado = criarEstadoBase();
  estado.jogadores.p1.mao.push({ id: 'c1', C: 5, M: 4, O: 3, A: 2, Força: 10, Vida: 10 });

  jogarCarta(estado, 'p1', 'c1');

  assert.equal(estado.jogadores.p1.recursos.C, 15);
  assert.equal(estado.jogadores.p1.recursos.M, 16);
  assert.equal(estado.jogadores.p1.mao.length, 0);
  assert.equal(estado.campo.p1.length, 1);
  assert.equal(estado.campo.p1[0].exaustao, true);
});


test('jogarCarta falha em fase inválida sem mutar estado', () => {
  const estado = criarEstadoBase();
  estado.fase = TURN_PHASES.REVELACAO;
  estado.jogadores.p1.mao.push({ id: 'c1', C: 1, M: 0, O: 0, A: 0, Força: 10, Vida: 10 });

  assert.throws(() => jogarCarta(estado, 'p1', 'c1'), { code: 'ACAO_FASE_INVALIDA' });

  assert.equal(estado.jogadores.p1.mao.length, 1);
  assert.equal(estado.campo.p1.length, 0);
});

test('jogarCarta resolve SACRIFICIO em fluxo completo de invocação e mortes', () => {
  const estado = criarEstadoBase();
  estado.jogadores.p1.mao.push({
    id: 'fanatico',
    C: 0,
    M: 0,
    O: 0,
    A: 0,
    Força: 6,
    Vida: 5,
    'Mecânica': 'Sacrifício (5)',
  });

  jogarCarta(estado, 'p1', 'fanatico');

  assert.equal(estado.campo.p1.length, 0);
  assert.deepEqual(estado.jogadores.p1.cemiterio.map((c) => c.id), ['fanatico']);
  assert.equal(estado.jogadores.p1.vida, 100);
  assert.equal(estado.jogadores.p2.vida, 100);
});

