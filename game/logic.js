const admin = require('firebase-admin');

const { normalizeCardAbilities } = require('./abilities');
const { TURN_PHASES } = require('./turn-phases');

const REGRAS_DECK = {
  TAMANHO_MINIMO: 30,
  TAMANHO_MAXIMO: 30,
  MAX_COPIAS_POR_CARTA: 3,
};

class DeckValidationError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'DeckValidationError';
    this.code = 'DECK_INVALIDO';
    this.context = context;
  }
}

function embaralhar(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function normalizarDeckIds(deckIds) {
  if (!Array.isArray(deckIds)) {
    return [];
  }

  return deckIds.map((id) => String(id));
}

function registrarRejeicaoDeck(uid, deckId, motivo, detalhes = {}) {
  console.warn('[AUDITORIA][DECK_REJEITADO]', {
    uid,
    deckId: String(deckId),
    motivo,
    detalhes,
  });
}

function validarRegrasDoDeck(deckIds, uid, deckId) {
  const tamanho = deckIds.length;

  if (tamanho < REGRAS_DECK.TAMANHO_MINIMO || tamanho > REGRAS_DECK.TAMANHO_MAXIMO) {
    const motivo = `Baralho inválido: esperado ${REGRAS_DECK.TAMANHO_MINIMO} cartas (mínimo/máximo), recebido ${tamanho}.`;
    registrarRejeicaoDeck(uid, deckId, 'tamanho_invalido', { tamanho, ...REGRAS_DECK });
    throw new DeckValidationError(motivo, { uid, deckId, tamanho });
  }

  const contagem = deckIds.reduce((acc, id) => {
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});

  const cartasComExcesso = Object.entries(contagem)
    .filter(([, copias]) => copias > REGRAS_DECK.MAX_COPIAS_POR_CARTA)
    .map(([id, copias]) => ({ id, copias }));

  if (cartasComExcesso.length > 0) {
    const motivo = `Baralho inválido: limite de ${REGRAS_DECK.MAX_COPIAS_POR_CARTA} cópias por carta excedido (${cartasComExcesso.map((c) => `${c.id}x${c.copias}`).join(', ')}).`;
    registrarRejeicaoDeck(uid, deckId, 'limite_de_copias_excedido', {
      cartasComExcesso,
      ...REGRAS_DECK,
    });
    throw new DeckValidationError(motivo, { uid, deckId, cartasComExcesso });
  }
}

function validarCartasExistentesNoCatalogo(deckIds, dadosCompletosCartas, uid, deckId) {
  const idsNaoEncontrados = [...new Set(deckIds.filter((id) => !dadosCompletosCartas[id]))];
  if (idsNaoEncontrados.length === 0) {
    return;
  }

  registrarRejeicaoDeck(uid, deckId, 'cartas_ausentes_em_cartas_mestras', {
    idsNaoEncontrados,
  });

  throw new DeckValidationError(
    `Baralho inválido (${deckId}): IDs ausentes em cartas_mestras: ${idsNaoEncontrados.join(', ')}.`,
    {
      uid,
      deckId,
      idsNaoEncontrados,
    }
  );
}

async function criarEstadoInicialDoJogo(db, userId1, deckId1, userId2, deckId2) {
  console.log(`📡 Buscando baralhos do Firestore... J1: ${deckId1}, J2: ${deckId2}`);

  const deck1Ref = db
    .collection('usuarios')
    .doc(userId1)
    .collection('baralhos')
    .doc(String(deckId1));
  const deck2Ref = db
    .collection('usuarios')
    .doc(userId2)
    .collection('baralhos')
    .doc(String(deckId2));

  const [doc1, doc2] = await Promise.all([deck1Ref.get(), deck2Ref.get()]);

  if (!doc1.exists) throw new Error(`❌ Baralho '${deckId1}' do Jogador 1 não encontrado!`);
  if (!doc2.exists) throw new Error(`❌ Baralho '${deckId2}' do Jogador 2 não encontrado!`);

  const deckIds1 = normalizarDeckIds(doc1.data().cartas);
  const deckIds2 = normalizarDeckIds(doc2.data().cartas);

  validarRegrasDoDeck(deckIds1, userId1, deckId1);
  validarRegrasDoDeck(deckIds2, userId2, deckId2);

  const todosOsIds = [...new Set([...deckIds1, ...deckIds2])];

  let baralhoCompleto1 = [];
  let baralhoCompleto2 = [];

  if (todosOsIds.length > 0) {
    const cartasRef = db.collection('cartas_mestras');
    const MAX_IDS = 30;
    const dadosCompletosCartas = {};

    // Faz consultas em batches de até 30 IDs para evitar erro do Firestore
    for (let i = 0; i < todosOsIds.length; i += MAX_IDS) {
      const batchIds = todosOsIds.slice(i, i + MAX_IDS);
      const snapshot = await cartasRef
        .where(admin.firestore.FieldPath.documentId(), 'in', batchIds)
        .get();

      snapshot.forEach((doc) => {
        dadosCompletosCartas[doc.id] = { id: doc.id, ...doc.data() };
      });
    }

    validarCartasExistentesNoCatalogo(deckIds1, dadosCompletosCartas, userId1, deckId1);
    validarCartasExistentesNoCatalogo(deckIds2, dadosCompletosCartas, userId2, deckId2);

    baralhoCompleto1 = deckIds1.map((id) => normalizeCardAbilities(dadosCompletosCartas[id]));
    baralhoCompleto2 = deckIds2.map((id) => normalizeCardAbilities(dadosCompletosCartas[id]));
  } else {
    console.log('Aviso: um ou ambos os baralhos carregados estão vazios.');
  }

  const baralhoJogador1 = embaralhar(baralhoCompleto1);
  const baralhoJogador2 = embaralhar(baralhoCompleto2);

  const maoJogador1 = baralhoJogador1.splice(0, 5);
  const maoJogador2 = baralhoJogador2.splice(0, 5);

  return {
    jogadores: {
      [userId1]: {
        vida: 100,
        recursos: { C: 10, M: 10, O: 10, A: 0 },
        recursosMax: { C: 60, M: 60, O: 60, A: 60 },
        geracaoRecursos: { C: 10, M: 10, O: 10, A: 10 },
        mao: maoJogador1,
        baralho: baralhoJogador1,
        cemiterio: [],
      },
      [userId2]: {
        vida: 100,
        recursos: { C: 10, M: 10, O: 10, A: 0 },
        recursosMax: { C: 60, M: 60, O: 60, A: 60 },
        geracaoRecursos: { C: 10, M: 10, O: 10, A: 10 },
        mao: maoJogador2,
        baralho: baralhoJogador2,
        cemiterio: [],
      },
    },
    turno: userId1,
    fase: TURN_PHASES.MANIFESTACAO,
    campo: { [userId1]: [], [userId2]: [] },
  };
}

module.exports = {
  criarEstadoInicialDoJogo,
  REGRAS_DECK,
  DeckValidationError,
};
