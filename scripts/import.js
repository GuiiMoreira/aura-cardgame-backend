const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');
const data = require('./cartas.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const collectionName = 'cartas_mestras';

function validarDadosCartas(cartas) {
  const idsVistos = new Set();

  for (const item of cartas) {
    if (!item.id || typeof item.id !== 'string') {
      throw new Error(
        `Carta inválida encontrada: ${JSON.stringify(item)}. Campo 'id' é obrigatório e deve ser string.`
      );
    }

    if (idsVistos.has(item.id)) {
      throw new Error(`ID duplicado encontrado em cartas.json: ${item.id}`);
    }

    idsVistos.add(item.id);
  }
}

const importData = async () => {
  validarDadosCartas(data);
  console.log(
    `Iniciando a importação de ${data.length} documentos para a coleção '${collectionName}'...`
  );

  const batch = db.batch();

  data.forEach((item) => {
    const docRef = db.collection(collectionName).doc(item.id);
    batch.set(docRef, item, { merge: true });
  });

  await batch.commit();
  console.log('Importação concluída com sucesso!');
};

importData().catch((error) => {
  console.error('Ocorreu um erro durante a importação:', error);
  process.exit(1);
});
