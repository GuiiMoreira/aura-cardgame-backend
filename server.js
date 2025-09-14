require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const admin = require('firebase-admin');

const gerenciarSockets = require('./sockets/manager');

// --- LEITURA DAS CREDENCIAIS ---
let serviceAccount;
if (process.env.GOOGLE_CREDENTIALS_BASE64) {
    console.log("✅ Variável GOOGLE_CREDENTIALS_BASE64 encontrada. Decodificando...");
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf8');
    serviceAccount = JSON.parse(credentialsJson);
} else {
    console.log("⚠️ GOOGLE_CREDENTIALS_BASE64 não encontrada. Carregando credenciais locais...");
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
