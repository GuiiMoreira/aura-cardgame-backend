const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const admin = require('firebase-admin');
const gerenciarSockets = require('./sockets/manager');

const serviceAccount = JSON.parse(process.env.GOOGLE_CREDENTIALS);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] } });
const PORT = process.env.PORT || 3000;

gerenciarSockets(io, db);

server.listen(PORT, () => {
    console.log(`Servidor de jogo rodando na porta ${PORT}`);
});