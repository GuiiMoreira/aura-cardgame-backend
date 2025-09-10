const admin = require('firebase-admin');

// Remova a linha 'const mockDeck = require(...);' se ela ainda existir.

function embaralhar(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// CORRIGIDO: A função agora aceita 'db' como o primeiro parâmetro.
async function criarEstadoInicialDoJogo(db, jogador1Id, jogador2Id) {
    console.log("Buscando baralhos do Firestore...");

    const deckReceitaRef = db.collection('baralhos').doc('usuario_teste_01');
    const doc = await deckReceitaRef.get();

    if (!doc.exists) {
        throw new Error("Baralho 'usuario_teste_01' não encontrado no Firestore!");
    }

    const deckIds = doc.data().cartas;

    if (!deckIds || deckIds.length === 0) {
        throw new Error("O baralho encontrado está vazio ou não tem a propriedade 'cartas'.");
    }

    const cartasRef = db.collection('cartas_mestras');
    const snapshot = await cartasRef.where(admin.firestore.FieldPath.documentId(), 'in', deckIds).get();

    const dadosCompletosCartas = {};
    snapshot.forEach(doc => {
        dadosCompletosCartas[doc.id] = { id: doc.id, ...doc.data() };
    });

    const baralhoCompleto = deckIds.map(id => dadosCompletosCartas[id]);

    console.log(`Baralho com ${baralhoCompleto.length} cartas carregado.`);

    const baralhoJogador1 = embaralhar([...baralhoCompleto]);
    const baralhoJogador2 = embaralhar([...baralhoCompleto]);
    const maoJogador1 = baralhoJogador1.splice(0, 5);
    const maoJogador2 = baralhoJogador2.splice(0, 5);

    return {
        jogadores: {
            [jogador1Id]: { vida: 100, recursos: { C: 10, M: 10, O: 10, A: 0 }, recursosMax: { C: 60, M: 60, O: 60, A: 60 }, geracaoRecursos: { C: 10, M: 10, O: 10, A: 10 }, mao: maoJogador1, baralho: baralhoJogador1, cemiterio: [] },
            [jogador2Id]: { vida: 100, recursos: { C: 10, M: 10, O: 10, A: 0 }, recursosMax: { C: 60, M: 60, O: 60, A: 60 }, geracaoRecursos: { C: 10, M: 10, O: 10, A: 10 }, mao: maoJogador2, baralho: baralhoJogador2, cemiterio: [] },
        },
        turno: jogador1Id,
        fase: 'Manifestação',
        campo: { [jogador1Id]: [], [jogador2Id]: [] }
    };
}

module.exports = {
    criarEstadoInicialDoJogo
};