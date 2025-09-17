const admin = require('firebase-admin');

function embaralhar(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function criarEstadoInicialDoJogo(db, userId1, deckId1, userId2, deckId2) {
    console.log(`📡 Buscando baralhos... J1(${userId1}): ${deckId1}, J2(${userId2}): ${deckId2}`);
    
    const deck1Ref = db.collection('usuarios').doc(userId1).collection('baralhos').doc(String(deckId1));
    const deck2Ref = db.collection('usuarios').doc(userId2).collection('baralhos').doc(String(deckId2));
    
    const [doc1, doc2] = await Promise.all([deck1Ref.get(), deck2Ref.get()]);

    if (!doc1.exists) throw new Error(`❌ Baralho '${deckId1}' do Jogador 1 não encontrado!`);
    if (!doc2.exists) throw new Error(`❌ Baralho '${deckId2}' do Jogador 2 não encontrado!`);

    const deckIds1 = doc1.data().cartas;
    const deckIds2 = doc2.data().cartas;

    const todosOsIds = [...new Set([...deckIds1, ...deckIds2])];
    
    let baralhoCompleto1 = [], baralhoCompleto2 = [];
    if (todosOsIds.length > 0) {
        const cartasRef = db.collection('cartas_mestras');
        const snapshot = await cartasRef.where(admin.firestore.FieldPath.documentId(), 'in', todosOsIds).get();
        const dadosCompletosCartas = {};
        snapshot.forEach(doc => {
            dadosCompletosCartas[doc.id] = { id: doc.id, ...doc.data() };
        });
        baralhoCompleto1 = deckIds1.map(id => dadosCompletosCartas[id]);
        baralhoCompleto2 = deckIds2.map(id => dadosCompletosCartas[id]);
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
                precisaDescartar: false // NOVO
            },
            [userId2]: {
                vida: 100,
                recursos: { C: 10, M: 10, O: 10, A: 0 },
                recursosMax: { C: 60, M: 60, O: 60, A: 60 },
                geracaoRecursos: { C: 10, M: 10, O: 10, A: 10 },
                mao: maoJogador2,
                baralho: baralhoJogador2,
                cemiterio: [],
                precisaDescartar: false // NOVO
            },
        },
        turno: userId1,
        fase: 'Manifestação',
        campo: { [userId1]: [], [userId2]: [] }
    };
}

module.exports = {
    criarEstadoInicialDoJogo
};
