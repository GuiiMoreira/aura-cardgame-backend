// 1. Importa as bibliotecas necessárias
const admin = require('firebase-admin');

// 2. Importa os arquivos JSON
const serviceAccount = require('./serviceAccountKey.json');
const data = require('./cartas.json');

// 3. Inicializa o app do Firebase Admin com suas credenciais
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// 4. Pega uma referência para o seu banco de dados Firestore
const db = admin.firestore();

// 5. Define para qual coleção os dados serão enviados
const collectionName = 'cartas_mestras';

// Função principal que faz a importação
const importData = async () => {
    console.log(`Iniciando a importação de ${data.length} documentos para a coleção '${collectionName}'...`);

    // Usamos um "Batch Write" para enviar múltiplos documentos de uma vez, o que é muito mais eficiente.
    const batch = db.batch();

    data.forEach((item, index) => {
        // Para cada item no seu JSON, criamos um novo documento na coleção.
        // O Firestore gerará um ID automático para cada um.
        const docRef = db.collection(collectionName).doc();
        batch.set(docRef, item);

        // O Firestore limita um batch a 500 operações. Se seu JSON for maior,
        // o script precisaria ser um pouco mais complexo para dividir em múltiplos batches.
        // Para 250 cartas, um único batch é perfeito.
    });

    // 6. Envia o batch para o Firestore
    await batch.commit();

    console.log('Importação concluída com sucesso!');
};

// Executa a função e finaliza o processo
importData().catch(error => {
    console.error('Ocorreu um erro durante a importação:', error);
});