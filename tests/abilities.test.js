const test = require('node:test');
const assert = require('node:assert/strict');

const { passarTurno, declararAtaque, jogarCarta, ativarHabilidadeDaCarta } = require('../game/actions');
const {
  abilityRegistry,
  getAbilitiesFromCard,
  parseTextualMechanics,
  normalizeCardAbilities,
  getSacrificioSpec,
} = require('../game/abilities');
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

test('INSTAVEL ativa no beforeAttack', () => {
  const estado = criarEstadoBase();
  estado.fase = TURN_PHASES.GUERRA_DOS_VEUS;
  estado.campo.p1.push({
    id: 'atk',
    Força: 15,
    Vida: 40,
    exaustao: false,
    habilidades: [{ tipo: 'INSTAVEL', valor: 2 }],
  });
  estado.campo.p2.push({ id: 'def', Força: 10, Vida: 40, exaustao: false });

  declararAtaque(estado, 'p1', 'atk', 'def');

  assert.equal(estado.campo.p1[0].Vida, 10);
  assert.equal(estado.campo.p2[0].Vida, 5);
});

test('ULTIMO_SUSPIRO ativa no onDeath com ordem de resolução previsível', () => {
  const estado = criarEstadoBase();
  estado.fase = TURN_PHASES.GUERRA_DOS_VEUS;
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
  assert.deepEqual(
    estado.jogadores.p1.cemiterio.map((c) => c.id),
    ['atk']
  );
  assert.deepEqual(
    estado.jogadores.p2.cemiterio.map((c) => c.id),
    ['def']
  );
});

test('REGENERACAO ativa ao iniciar próximo turno após ciclo de fases', () => {
  const estado = criarEstadoBase();
  estado.fase = TURN_PHASES.SILENCIO_FINAL;
  estado.campo.p2.push({
    id: 'guardiao',
    Força: 5,
    Vida: 10,
    exaustao: true,
    habilidades: [{ tipo: 'REGENERACAO', valor: 3 }],
  });

  passarTurno(estado, 'p1');

  assert.equal(estado.fase, TURN_PHASES.RITUAL_DE_GERACAO);
  assert.equal(estado.turno, 'p2');
  assert.equal(estado.campo.p2[0].exaustao, false);
  assert.equal(estado.campo.p2[0].Vida, 13);
});

test('RECARREGAVEL reduz turnosRecarga no início do próximo turno', () => {
  const estado = criarEstadoBase();
  estado.fase = TURN_PHASES.SILENCIO_FINAL;
  estado.campo.p2.push({
    id: 'canhoneiro',
    Força: 5,
    Vida: 10,
    exaustao: true,
    turnosRecarga: 2,
    habilidades: [{ tipo: 'RECARREGAVEL', valor: 1 }],
  });

  passarTurno(estado, 'p1');

  assert.equal(estado.campo.p2[0].turnosRecarga, 1);
});

test('afterAttack é integrado em declararAtaque', () => {
  const estado = criarEstadoBase();
  estado.fase = TURN_PHASES.GUERRA_DOS_VEUS;
  const marcador = [];
  abilityRegistry.TESTE_AFTER = {
    afterAttack: ({ sourceCard }) => {
      marcador.push(sourceCard.id);
    },
  };

  estado.campo.p1.push({
    id: 'atk',
    Força: 15,
    Vida: 20,
    exaustao: false,
    habilidades: [{ tipo: 'TESTE_AFTER' }],
  });
  estado.campo.p2.push({ id: 'def', Força: 10, Vida: 20, exaustao: false });

  declararAtaque(estado, 'p1', 'atk', 'def');

  assert.deepEqual(marcador, ['atk']);
  delete abilityRegistry.TESTE_AFTER;
});

test('normalização de habilidades aceita params.valor e ordena por prioridade/empate', () => {
  const habilidades = getAbilitiesFromCard({
    habilidades: [
      { tipo: 'impacto', params: { valor: 1 }, prioridade: 0 },
      { tipo: 'IMPACTO', valor: 2, prioridade: 5 },
      { tipo: 'IMPACTO', valor: 3, prioridade: 5 },
    ],
  });

  assert.deepEqual(
    habilidades.map((h) => h.tipo),
    ['IMPACTO', 'IMPACTO', 'IMPACTO']
  );
  assert.deepEqual(
    habilidades.map((h) => h.params.valor),
    [1, 2, 3]
  );
  assert.deepEqual(
    habilidades.map((h) => h.prioridade),
    [0, 5, 5]
  );
  assert.deepEqual(
    habilidades.map((h) => h.sourceIndex),
    [0, 1, 2]
  );
});

test('parser textual converte mecânica com fallback e ignora tokens inválidos', () => {
  const habilidades = parseTextualMechanics('Impacto (2); Desconhecida (9) | Recarregável (1)');

  assert.deepEqual(
    habilidades.map((h) => [h.tipo, h.params.valor]),
    [
      ['IMPACTO', 2],
      ['RECARREGAVEL', 1],
    ]
  );
});


test('parser textual aceita formato sem parênteses para valor', () => {
  const habilidades = parseTextualMechanics('Alquimia 4; Impacto 1');

  assert.deepEqual(
    habilidades.map((h) => [h.tipo, h.params.valor]),
    [
      ['ALQUIMIA', 4],
      ['IMPACTO', 1],
    ]
  );
});

test('parser textual normaliza acentos e espaçamento do nome da mecânica', () => {
  const habilidades = parseTextualMechanics('  recarregavel   ;   Sacrificio (2) ');

  assert.deepEqual(
    habilidades.map((h) => [h.tipo, h.params.valor]),
    [
      ['RECARREGAVEL', 0],
      ['SACRIFICIO', 2],
    ]
  );
});

test('parser textual registra warning para mecânicas desconhecidas e tokens inválidos', () => {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(message);

  try {
    const habilidades = parseTextualMechanics('Mecânica X; ???; Recarregável');

    assert.deepEqual(
      habilidades.map((h) => [h.tipo, h.params.valor]),
      [['RECARREGAVEL', 0]]
    );
    assert.equal(warnings.length, 2);
    assert.match(warnings[0], /Mecânica desconhecida ignorada/);
    assert.match(warnings[1], /Mecânica textual inválida ignorada/);
  } finally {
    console.warn = originalWarn;
  }
});

test('SACRIFICIO ativa no onSummon e pode enviar a própria carta ao cemitério via resolveDeaths', () => {
  const estado = criarEstadoBase();
  estado.jogadores.p1.mao.push({
    id: 'cultista',
    C: 0,
    M: 0,
    O: 0,
    A: 0,
    Força: 3,
    Vida: 2,
    habilidades: [{ tipo: 'SACRIFICIO', valor: 2 }],
  });

  jogarCarta(estado, 'p1', 'cultista');

  assert.equal(estado.campo.p1.length, 0);
  assert.deepEqual(
    estado.jogadores.p1.cemiterio.map((c) => c.id),
    ['cultista']
  );
  assert.equal(estado.jogadores.p1.vida, 100);
  assert.equal(estado.jogadores.p2.vida, 100);
});

test('parser textual reconhece Sacrifício (X)', () => {
  const habilidades = parseTextualMechanics('Sacrifício (4); Impacto (1)');

  assert.deepEqual(
    habilidades.map((h) => [h.tipo, h.params.valor]),
    [
      ['SACRIFICIO', 4],
      ['IMPACTO', 1],
    ]
  );
});
test('normalizeCardAbilities preenche habilidades a partir de Mecânica', () => {
  const carta = normalizeCardAbilities({ id: 'c1', Mecânica: 'Último Suspiro (3)' });

  assert.equal(carta.habilidades.length, 1);
  assert.equal(carta.habilidades[0].tipo, 'ULTIMO_SUSPIRO');
  assert.equal(carta.habilidades[0].params.valor, 3);
});

test('parser textual reconhece ALQUIMIA (X)', () => {
  const habilidades = parseTextualMechanics('Alquimia (2); Impacto (1)');

  assert.deepEqual(
    habilidades.map((h) => [h.tipo, h.params.valor]),
    [
      ['ALQUIMIA', 2],
      ['IMPACTO', 1],
    ]
  );
});


test('ANTIMAGIA reduz dano mágico e consome usos por turno', () => {
  const estado = criarEstadoBase();
  estado.fase = TURN_PHASES.GUERRA_DOS_VEUS;
  estado.campo.p1.push({
    id: 'mago-instavel',
    Força: 10,
    Vida: 40,
    exaustao: false,
    habilidades: [{ tipo: 'INSTAVEL', valor: 2 }],
  });
  estado.campo.p2.push({
    id: 'guardiao-antimagia',
    Força: 10,
    Vida: 60,
    exaustao: false,
    habilidades: [{ tipo: 'ANTIMAGIA', valor: 1 }],
  });

  declararAtaque(estado, 'p1', 'mago-instavel', 'guardiao-antimagia');

  assert.equal(estado.campo.p2[0].Vida, 40);
  assert.equal(estado.campo.p1[0].Vida, 10);
  assert.equal(estado.campo.p2[0].antimagia.usosRestantes, 0);
});

test('ANTIMAGIA valor 3 bloqueia 3 efeitos mágicos e permite dano no 4º', () => {
  const estado = criarEstadoBase();
  estado.fase = TURN_PHASES.GUERRA_DOS_VEUS;
  estado.campo.p1.push({
    id: 'mago-instavel',
    Força: 0,
    Vida: 100,
    exaustao: false,
    habilidades: [{ tipo: 'INSTAVEL', valor: 1 }],
  });
  estado.campo.p2.push({
    id: 'bastiao-antimagia',
    Força: 0,
    Vida: 100,
    exaustao: false,
    habilidades: [{ tipo: 'ANTIMAGIA', valor: 3 }],
  });

  for (let i = 0; i < 4; i += 1) {
    estado.campo.p1[0].exaustao = false;
    declararAtaque(estado, 'p1', 'mago-instavel', 'bastiao-antimagia');
  }

  assert.equal(estado.campo.p2[0].Vida, 90);
  assert.equal(estado.campo.p2[0].antimagia.usosRestantes, 0);
});


test('ANTIMAGIA restaura usos no início do turno conforme valor', () => {
  const estado = criarEstadoBase();
  estado.fase = TURN_PHASES.GUERRA_DOS_VEUS;
  estado.campo.p2.push({
    id: 'sentinela',
    Força: 2,
    Vida: 30,
    exaustao: true,
    habilidades: [{ tipo: 'ANTIMAGIA', valor: 1 }],
    antimagia: { usosRestantes: 0 },
  });

  estado.fase = TURN_PHASES.SILENCIO_FINAL;
  passarTurno(estado, 'p1');

  assert.equal(estado.turno, 'p2');
  assert.equal(estado.campo.p2[0].antimagia.usosRestantes, 1);
});
test('parser textual reconhece Antimagia (X)', () => {
  const habilidades = parseTextualMechanics('Antimagia (3); Impacto (1)');

  assert.deepEqual(
    habilidades.map((h) => [h.tipo, h.params.valor]),
    [
      ['ANTIMAGIA', 3],
      ['IMPACTO', 1],
    ]
  );
});


test('parser textual reconhece Resíduo Áurico (X)', () => {
  const habilidades = parseTextualMechanics('Resíduo Áurico (1); Impacto (1)');

  assert.deepEqual(
    habilidades.map((h) => [h.tipo, h.params.valor]),
    [
      ['RESIDUO_AURICO', 1],
      ['IMPACTO', 1],
    ]
  );
});

test('RESIDUO_AURICO acumula resíduos ao conjurar feitiço e converte em +10 de força a cada 3', () => {
  const estado = criarEstadoBase();
  estado.campo.p1.push({
    id: 'alquimista',
    Força: 5,
    Vida: 20,
    exaustao: false,
    habilidades: [{ tipo: 'RESIDUO_AURICO', valor: 0 }],
  });
  estado.campo.p1.push({
    id: 'canalizador',
    Força: 1,
    Vida: 20,
    exaustao: false,
    habilidades: [{ tipo: 'ALQUIMIA', valor: 1 }],
  });
  estado.jogadores.p1.cemiterio = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];

  ativarHabilidadeDaCarta(estado, 'p1', 'canalizador', 'ALQUIMIA');
  assert.equal(estado.campo.p1[0].residuosAuricos, 1);
  assert.equal(estado.campo.p1[0].Força, 5);

  estado.jogadores.p1.cemiterio = [{ id: 'c4' }, { id: 'c5' }, { id: 'c6' }];
  ativarHabilidadeDaCarta(estado, 'p1', 'canalizador', 'ALQUIMIA');
  assert.equal(estado.campo.p1[0].residuosAuricos, 2);
  assert.equal(estado.campo.p1[0].Força, 5);

  estado.jogadores.p1.cemiterio = [{ id: 'c7' }, { id: 'c8' }, { id: 'c9' }];
  ativarHabilidadeDaCarta(estado, 'p1', 'canalizador', 'ALQUIMIA');
  assert.equal(estado.campo.p1[0].residuosAuricos, 0);
  assert.equal(estado.campo.p1[0].Força, 15);
});

test('RESIDUO_AURICO aplica múltiplos limiares e persiste entre turnos', () => {
  const estado = criarEstadoBase();
  estado.campo.p1.push({
    id: 'alquimista',
    Força: 5,
    Vida: 20,
    exaustao: false,
    residuosAuricos: 2,
    habilidades: [{ tipo: 'RESIDUO_AURICO', valor: 0 }],
  });
  estado.campo.p1.push({
    id: 'canalizador',
    Força: 1,
    Vida: 20,
    exaustao: false,
    habilidades: [{ tipo: 'ALQUIMIA', valor: 1 }],
  });

  estado.jogadores.p1.cemiterio = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];
  ativarHabilidadeDaCarta(estado, 'p1', 'canalizador', 'ALQUIMIA');
  assert.equal(estado.campo.p1[0].residuosAuricos, 0);
  assert.equal(estado.campo.p1[0].Força, 15);

  estado.fase = TURN_PHASES.SILENCIO_FINAL;
  passarTurno(estado, 'p2');
  passarTurno(estado, 'p1');
  passarTurno(estado, 'p2');
  passarTurno(estado, 'p1');

  assert.equal(estado.campo.p1[0].residuosAuricos, 0);
  assert.equal(estado.campo.p1[0].Força, 15);

  estado.jogadores.p1.cemiterio = [{ id: 'c4' }, { id: 'c5' }, { id: 'c6' }];
  ativarHabilidadeDaCarta(estado, 'p1', 'canalizador', 'ALQUIMIA');
  assert.equal(estado.campo.p1[0].residuosAuricos, 1);
  assert.equal(estado.campo.p1[0].Força, 15);

  estado.jogadores.p1.cemiterio = [{ id: 'c7' }, { id: 'c8' }, { id: 'c9' }, { id: 'c10' }, { id: 'c11' }, { id: 'c12' }];
  ativarHabilidadeDaCarta(estado, 'p1', 'canalizador', 'ALQUIMIA');
  ativarHabilidadeDaCarta(estado, 'p1', 'canalizador', 'ALQUIMIA');

  assert.equal(estado.campo.p1[0].residuosAuricos, 0);
  assert.equal(estado.campo.p1[0].Força, 25);
});


test('getSacrificioSpec usa DescricaoMecanica para distinguir auto e aliado', () => {
  const auto = getSacrificioSpec(
    { DescricaoMecanica: 'Sacrifique-se.' },
    { params: { valor: 1 } }
  );
  const comAliado = getSacrificioSpec(
    { DescricaoMecanica: 'Sacrifique a si e um aliado.' },
    { params: { valor: 2 } }
  );
  const comDoisAliados = getSacrificioSpec(
    { DescricaoMecanica: 'Sacrifique a si e mais dois aliados.' },
    { params: { valor: 3 } }
  );

  assert.deepEqual(auto, { totalSacrificios: 1, aliadosNecessarios: 0 });
  assert.deepEqual(comAliado, { totalSacrificios: 2, aliadosNecessarios: 1 });
  assert.deepEqual(comDoisAliados, { totalSacrificios: 3, aliadosNecessarios: 2 });
});
