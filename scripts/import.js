const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');
const data = require('./cartas.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const collectionName = 'cartas_mestras';
const BATCH_LIMIT = 500;

function parseArgs(argv) {
    const args = new Set(argv.slice(2));
    return {
        upsert: args.has('--upsert')
    };
}

function validateData(items) {
    if (!Array.isArray(items)) {
        throw new Error('O arquivo de entrada precisa ser um array de cartas.');
    }

    const errors = [];
    const seen = new Map();

    items.forEach((item, index) => {
        const hasId = item && Object.prototype.hasOwnProperty.call(item, 'id');
        const normalizedId = hasId ? String(item.id).trim() : '';

        if (!hasId || normalizedId.length === 0) {
            errors.push(`[${index}] carta sem "id" válido.`);
            return;
        }

        if (seen.has(normalizedId)) {
            errors.push(
                `[${index}] id duplicado "${normalizedId}" (já usado no índice ${seen.get(normalizedId)}).`
            );
            return;
        }

        seen.set(normalizedId, index);
    });

    if (errors.length > 0) {
        const details = errors.join('\n - ');
        throw new Error(`Validação falhou (${errors.length} erro(s)):\n - ${details}`);
    }
}

async function assertNoExistingDocs(items) {
    const ids = items.map(item => String(item.id).trim());
    const existentes = [];

    for (let i = 0; i < ids.length; i += 30) {
        const batchIds = ids.slice(i, i + 30);
        const snapshot = await db
            .collection(collectionName)
            .where(admin.firestore.FieldPath.documentId(), 'in', batchIds)
            .get();

        snapshot.forEach(doc => existentes.push(doc.id));
    }

    if (existentes.length > 0) {
        throw new Error(
            `Foram encontrados ${existentes.length} documento(s) já existente(s) em '${collectionName}'. ` +
            `Use --upsert para atualizar sem duplicar. IDs: ${existentes.join(', ')}`
        );
    }
}

async function importData({ upsert }) {
    console.log(
        `Iniciando a importação de ${data.length} documento(s) para '${collectionName}'` +
        `${upsert ? ' em modo UPSERT' : ''}...`
    );

    validateData(data);

    if (!upsert) {
        await assertNoExistingDocs(data);
    }

    let batch = db.batch();
    let operations = 0;
    let total = 0;

    for (const item of data) {
        const id = String(item.id).trim();
        const docRef = db.collection(collectionName).doc(id);

        if (upsert) {
            batch.set(docRef, item, { merge: true });
        } else {
            batch.set(docRef, item);
        }

        operations += 1;
        total += 1;

        if (operations === BATCH_LIMIT) {
            await batch.commit();
            batch = db.batch();
            operations = 0;
        }
    }

    if (operations > 0) {
        await batch.commit();
    }

    console.log(`Importação concluída com sucesso! ${total} documento(s) processado(s).`);
}

const options = parseArgs(process.argv);

importData(options).catch(error => {
    console.error('Ocorreu um erro durante a importação:', error.message || error);
    process.exitCode = 1;
});
