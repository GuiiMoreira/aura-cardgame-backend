const test = require('node:test');
const assert = require('node:assert/strict');

const { criarEstadoInicialDoJogo, DeckValidationError } = require('../game/logic');

function criarDbFalso({ decks, cartasMestras }) {
  return {
    collection(nomeColecao) {
      if (nomeColecao === 'usuarios') {
        return {
          doc(uid) {
            return {
              collection(subcolecao) {
                assert.equal(subcolecao, 'baralhos');
                return {
                  doc(deckId) {
                    return {
                      async get() {
                        const deck = decks?.[uid]?.[deckId];
                        return {
                          exists: Boolean(deck),
                          data: () => ({ cartas: deck || [] }),
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (nomeColecao === 'cartas_mestras') {
        return {
          where(_campo, _operador, ids) {
            return {
              async get() {
                const encontrados = ids
                  .filter((id) => cartasMestras[id])
                  .map((id) => ({ id, data: () => cartasMestras[id] }));

                return {
                  forEach(callback) {
                    encontrados.forEach(callback);
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Coleção não suportada no mock: ${nomeColecao}`);
    },
  };
}

function criarDeckValido() {
  const cartas = [];
  for (let i = 1; i <= 10; i += 1) {
    cartas.push(`c${i}`, `c${i}`, `c${i}`);
  }
  return cartas;
}

function criarCartasMestras() {
  const cartas = {};
  for (let i = 1; i <= 12; i += 1) {
    cartas[`c${i}`] = { Nome: `Carta ${i}`, Força: 10, Vida: 10, C: 1, M: 1, O: 1, A: 0 };
  }
  return cartas;
}

test('criarEstadoInicialDoJogo aceita deck válido com 30 cartas e até 3 cópias', async () => {
  const deck1 = criarDeckValido();
  const deck2 = criarDeckValido();

  const db = criarDbFalso({
    decks: { u1: { d1: deck1 }, u2: { d2: deck2 } },
    cartasMestras: criarCartasMestras(),
  });

  const estado = await criarEstadoInicialDoJogo(db, 'u1', 'd1', 'u2', 'd2');

  assert.equal(estado.jogadores.u1.mao.length, 5);
  assert.equal(estado.jogadores.u1.baralho.length, 25);
  assert.equal(estado.jogadores.u2.mao.length, 5);
  assert.equal(estado.jogadores.u2.baralho.length, 25);
});

test('criarEstadoInicialDoJogo rejeita deck com tamanho inválido', async () => {
  const deckInvalido = criarDeckValido().slice(0, 29);

  const db = criarDbFalso({
    decks: { u1: { d1: deckInvalido }, u2: { d2: criarDeckValido() } },
    cartasMestras: criarCartasMestras(),
  });

  await assert.rejects(
    () => criarEstadoInicialDoJogo(db, 'u1', 'd1', 'u2', 'd2'),
    (error) => error instanceof DeckValidationError && error.message.includes('esperado 30 cartas')
  );
});


test('criarEstadoInicialDoJogo rejeita deck com mais de 30 cartas', async () => {
  const deckInvalido = [...criarDeckValido(), 'c11'];

  const db = criarDbFalso({
    decks: { u1: { d1: deckInvalido }, u2: { d2: criarDeckValido() } },
    cartasMestras: criarCartasMestras(),
  });

  await assert.rejects(
    () => criarEstadoInicialDoJogo(db, 'u1', 'd1', 'u2', 'd2'),
    (error) => error instanceof DeckValidationError && error.message.includes('esperado 30 cartas')
  );
});

test('criarEstadoInicialDoJogo rejeita deck com mais cópias do que o permitido', async () => {
  const deckInvalido = ['c1', 'c1', 'c1', 'c1', ...criarDeckValido().slice(4, 30)];

  const db = criarDbFalso({
    decks: { u1: { d1: deckInvalido }, u2: { d2: criarDeckValido() } },
    cartasMestras: criarCartasMestras(),
  });

  await assert.rejects(
    () => criarEstadoInicialDoJogo(db, 'u1', 'd1', 'u2', 'd2'),
    (error) => error instanceof DeckValidationError && error.message.includes('limite de 3 cópias')
  );
});

test('criarEstadoInicialDoJogo rejeita deck com IDs ausentes em cartas_mestras', async () => {
  const deckComCartaInexistente = ['c999', ...criarDeckValido().slice(1)];

  const db = criarDbFalso({
    decks: { u1: { d1: deckComCartaInexistente }, u2: { d2: criarDeckValido() } },
    cartasMestras: criarCartasMestras(),
  });

  await assert.rejects(
    () => criarEstadoInicialDoJogo(db, 'u1', 'd1', 'u2', 'd2'),
    (error) =>
      error instanceof DeckValidationError &&
      error.message.includes('Baralho inválido (d1): IDs ausentes em cartas_mestras: c999')
  );
});


test('criarEstadoInicialDoJogo rejeita quando o segundo deck referencia carta inexistente', async () => {
  const deck2Invalido = ['c404', ...criarDeckValido().slice(1)];

  const db = criarDbFalso({
    decks: { u1: { d1: criarDeckValido() }, u2: { d2: deck2Invalido } },
    cartasMestras: criarCartasMestras(),
  });

  await assert.rejects(
    () => criarEstadoInicialDoJogo(db, 'u1', 'd1', 'u2', 'd2'),
    (error) =>
      error instanceof DeckValidationError &&
      error.message.includes('Baralho inválido (d2): IDs ausentes em cartas_mestras: c404')
  );
});
