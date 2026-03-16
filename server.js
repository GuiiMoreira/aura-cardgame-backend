require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');

const gerenciarSockets = require('./sockets/manager');

function carregarCredenciaisFirebase() {
    if (process.env.GOOGLE_CREDENTIALS_BASE64) {
        try {
            console.log('✅ Variável GOOGLE_CREDENTIALS_BASE64 encontrada. Decodificando...');
            const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf8');
            return JSON.parse(credentialsJson);
        } catch (error) {
            throw new Error(`GOOGLE_CREDENTIALS_BASE64 inválida: ${error.message}`);
        }
    }

    const credenciaisLocais = path.resolve(__dirname, 'serviceAccountKey.json');
    if (fs.existsSync(credenciaisLocais)) {
        console.log('⚠️ GOOGLE_CREDENTIALS_BASE64 não encontrada. Carregando credenciais locais...');
        return require(credenciaisLocais);
    }

    throw new Error('Credenciais do Firebase não encontradas. Configure GOOGLE_CREDENTIALS_BASE64 ou crie serviceAccountKey.json na raiz do projeto.');
}

function validarCredenciais(serviceAccount) {
    const camposObrigatorios = ['project_id', 'client_email', 'private_key'];
    const faltantes = camposObrigatorios.filter((campo) => !serviceAccount?.[campo]);
    if (faltantes.length > 0) {
        throw new Error(`Credenciais do Firebase incompletas. Campos obrigatórios ausentes: ${faltantes.join(', ')}`);
    }
}

let serviceAccount;
try {
    serviceAccount = carregarCredenciaisFirebase();
    validarCredenciais(serviceAccount);
} catch (error) {
    console.error(`❌ Falha na inicialização das credenciais Firebase: ${error.message}`);
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST'],
    },
});

io.use(async (socket, next) => {
    const token = socket.handshake?.auth?.token;

    if (!token || typeof token !== 'string') {
        socket.authError = 'Token de autenticação ausente ou inválido.';
        return next();
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        socket.user = {
            uid: decodedToken.uid,
            ...decodedToken,
        };
    } catch (error) {
        socket.authError = 'Token de autenticação inválido ou expirado.';
    }

    return next();
});

const PORT = process.env.PORT || 3000;

gerenciarSockets(io, db);

server.listen(PORT, () => {
    console.log(`🚀 Servidor de jogo rodando na porta ${PORT}`);
});
