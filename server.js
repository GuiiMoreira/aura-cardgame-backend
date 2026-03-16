require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");
const cors = require('cors');
const admin = require('firebase-admin');

const gerenciarSockets = require('./sockets/manager');

// --- LEITURA DAS CREDENCIAIS ---
const validateServiceAccount = (credentials) => {
    const requiredFields = ['project_id', 'client_email', 'private_key'];
    const missingFields = requiredFields.filter((field) => !credentials?.[field]);

    if (missingFields.length > 0) {
        throw new Error(`Credenciais inválidas: campos obrigatórios ausentes (${missingFields.join(', ')}).`);
    }

    return credentials;
};

let serviceAccount;

try {
    if (process.env.GOOGLE_CREDENTIALS_BASE64) {
        console.log("✅ Variável GOOGLE_CREDENTIALS_BASE64 encontrada. Decodificando...");

        let credentialsJson;
        try {
            credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf8');
            serviceAccount = JSON.parse(credentialsJson);
        } catch (error) {
            throw new Error(`GOOGLE_CREDENTIALS_BASE64 está inválida (base64/JSON): ${error.message}`);
        }
    } else {
        const localCredentialsPath = path.resolve(__dirname, 'serviceAccountKey.json');
        console.log(`⚠️ GOOGLE_CREDENTIALS_BASE64 não encontrada. Carregando credenciais locais em ${localCredentialsPath}...`);

        try {
            serviceAccount = require(localCredentialsPath);
        } catch (error) {
            throw new Error(`Arquivo local de credenciais não encontrado ou inválido em '${localCredentialsPath}'.`);
        }
    }

    serviceAccount = validateServiceAccount(serviceAccount);
} catch (error) {
    console.error(`❌ Falha ao carregar credenciais do Firebase: ${error.message}`);
    console.error('Configure GOOGLE_CREDENTIALS_BASE64 com o JSON da conta de serviço em base64 ou crie ./serviceAccountKey.json válido.');
    process.exit(1);
}

// --- INICIALIZAÇÃO DO FIREBASE ---
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// --- CONFIGURAÇÃO DO SERVIDOR ---
const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // ajuste conforme seu frontend
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3000;

// --- INICIALIZAÇÃO DO JOGO ---
gerenciarSockets(io, db);

// --- INICIA O SERVIDOR ---
server.listen(PORT, () => {
    console.log(`🚀 Servidor de jogo rodando na porta ${PORT}`);
});
