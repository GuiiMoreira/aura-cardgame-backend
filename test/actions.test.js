const test = require('node:test');
const assert = require('node:assert/strict');
const { passarTurno, jogarCarta, atacarFortaleza, declararAtaque } = require('../game/actions');

function criarEstadoBase() {
  return {
    jogadores: {
      j1: {
        vida: 100,
        recursos: { C: 10, M: 5, O: 5, A: 0 },
        recursosMax: { C: 20, M: 20, O: 20, A: 10 },
        geracaoRecursos: { C: 3, M: 2, O: 1, A: 1 },
        mao: [],
        baralho: [],
        cemiterio: [],
      },
      j2: {
        vida: 100,
        recursos: { C: 10, M: 10, O: 10, A: 0 },
        recursosMax: { C: 12, M: 12, O: 12, A: 5 },
        geracaoRecursos: { C: 5, M: 5, O: 5, A: 2 },
        mao: [],
        baralho: [],
        cemiterio: [],
      },
    },
    turno: 'j1',
    campo: { j1: [], j2: [] },
  };
}

test('passarTurno: gera recursos, compra carta e remove exaustão', () => {
  const estado = criarEstadoBase();
  estado.jogadores.j2.baralho = [{ id: 'nova' }];
  estado.jogadores.j2.recursos = { C: 10, M: 11, O: 12, A: 5 };
  estado.campo.j2 = [{ id: 'c1', exaustao: true }];

  const resultado = passarTurno(estado, 'j1');

  assert.equal(resultado.ok, true);
  assert.equal(resultado.estado.turno, 'j2');
  assert.deepEqual(resultado.estado.jogadores.j2.mao, [{ id: 'nova' }]);
  assert.deepEqual(resultado.estado.jogadores.j2.recursos, { C: 12, M: 12, O: 12, A: 5 });
  assert.equal(resultado.estado.campo.j2[0].exaustao, false);
  assert.equal(estado.turno, 'j1');
});

test('jogarCarta: consome recursos e aplica exaustão', () => {
  const estado = criarEstadoBase();
  estado.jogadores.j1.mao = [{ id: 'x1', C: 3, M: 2, O: 1, A: 0 }];

  const resultado = jogarCarta(estado, 'j1', 'x1');

  assert.equal(resultado.ok, true);
  assert.deepEqual(resultado.estado.jogadores.j1.recursos, { C: 7, M: 3, O: 4, A: 0 });
  assert.equal(resultado.estado.jogadores.j1.mao.length, 0);
  assert.equal(resultado.estado.campo.j1[0].exaustao, true);
});

test('jogarCarta: bloqueia recursos insuficientes', () => {
  const estado = criarEstadoBase();
  estado.jogadores.j1.mao = [{ id: 'x2', C: 30, M: 0, O: 0, A: 0 }];

  const resultado = jogarCarta(estado, 'j1', 'x2');

  assert.equal(resultado.ok, false);
  assert.equal(resultado.motivo, 'recursos_insuficientes');
});

test('atacarFortaleza: só atacantes válidos causam dano e pode finalizar jogo', () => {
  const estado = criarEstadoBase();
  estado.jogadores.j2.vida = 20;
  estado.campo.j1 = [
    { id: 'a1', Força: 15, exaustao: false },
    { id: 'a2', Força: 10, exaustao: true },
    { id: 'a3', Força: 0, exaustao: false },
  ];

  const resultado = atacarFortaleza(estado, 'j1', ['a1', 'a2', 'a3', 'nao-existe']);
  assert.equal(resultado.estado.jogadores.j2.vida, 5);
  assert.equal(resultado.estado.campo.j1[0].exaustao, true);
  assert.equal(resultado.fimDeJogo, false);

  const estadoProntoParaGolpeFinal = JSON.parse(JSON.stringify(resultado.estado));
  estadoProntoParaGolpeFinal.campo.j1[0].exaustao = false;
  const letal = atacarFortaleza(estadoProntoParaGolpeFinal, 'j1', ['a1']);
  assert.equal(letal.fimDeJogo, true);
  assert.equal(letal.vencedor, 'j1');
});

test('declararAtaque: resolve dano, exaustão e cemitério', () => {
  const estado = criarEstadoBase();
  estado.campo.j1 = [{ id: 'atk', Vida: 40, Força: 50, exaustao: false }];
  estado.campo.j2 = [{ id: 'def', Vida: 30, Força: 45, exaustao: false }];

  const resultado = declararAtaque(estado, 'j1', 'atk', 'def');

  assert.equal(resultado.ok, true);
  assert.equal(resultado.estado.campo.j1.length, 0);
  assert.equal(resultado.estado.campo.j2.length, 0);
  assert.equal(resultado.estado.jogadores.j1.cemiterio[0].id, 'atk');
  assert.equal(resultado.estado.jogadores.j2.cemiterio[0].id, 'def');
});

test('declararAtaque: aplica Instável antes da troca', () => {
  const estado = criarEstadoBase();
  estado.campo.j1 = [{ id: 'atk', Vida: 100, Força: 20, Mecânica: 'Instável(3)', exaustao: false }];
  estado.campo.j2 = [{ id: 'def', Vida: 80, Força: 10, exaustao: false }];

  const resultado = declararAtaque(estado, 'j1', 'atk', 'def');

  assert.equal(resultado.estado.campo.j1[0].Vida, 60);
  assert.equal(resultado.estado.campo.j2[0].Vida, 30);
});

test('declararAtaque: retorna inválido com atacante exausto', () => {
  const estado = criarEstadoBase();
  estado.campo.j1 = [{ id: 'atk', Vida: 20, Força: 20, exaustao: true }];
  estado.campo.j2 = [{ id: 'def', Vida: 20, Força: 20, exaustao: false }];

  const resultado = declararAtaque(estado, 'j1', 'atk', 'def');

  assert.equal(resultado.ok, false);
  assert.equal(resultado.motivo, 'ataque_invalido');
});
