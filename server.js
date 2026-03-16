require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');

const gerenciarSockets = require('./sockets/manager');
const { logger, createRequestId, SENSITIVE_KEYS } = require('./logger');

const CURRENT_PROTOCOL_VERSION = '1.1.0';
const LEGACY_PROTOCOL_VERSION = 'legacy-v1';

function carregarCredenciaisFirebase() {
  if (process.env.GOOGLE_CREDENTIALS_BASE64) {
    try {
      logger.info('GOOGLE_CREDENTIALS_BASE64 encontrada, iniciando decodificação.');
      const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString(
        'utf8'
      );
      return JSON.parse(credentialsJson);
    } catch (error) {
      throw new Error(`GOOGLE_CREDENTIALS_BASE64 inválida: ${error.message}`);
    }
  }

  const credenciaisLocais = path.resolve(__dirname, 'serviceAccountKey.json');
  if (fs.existsSync(credenciaisLocais)) {
    logger.warn('GOOGLE_CREDENTIALS_BASE64 ausente, carregando credenciais locais.');
    return require(credenciaisLocais);
  }

  throw new Error(
    'Credenciais do Firebase não encontradas. Configure GOOGLE_CREDENTIALS_BASE64 ou crie serviceAccountKey.json na raiz do projeto.'
  );
}

function validarCredenciais(serviceAccount) {
  const camposObrigatorios = ['project_id', 'client_email', 'private_key'];
  const faltantes = camposObrigatorios.filter((campo) => !serviceAccount?.[campo]);
  if (faltantes.length > 0) {
    throw new Error(
      `Credenciais do Firebase incompletas. Campos obrigatórios ausentes: ${faltantes.join(', ')}`
    );
  }
}

function configurarObservabilidadeHttp(app, getSocketMetrics) {
  app.use((req, res, next) => {
    const requestId = req.header('x-request-id') || createRequestId();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const baseContext = {
        requestId,
        method: req.method,
        route: req.originalUrl,
        statusCode: res.statusCode,
        latencyMs: Number(durationMs.toFixed(2)),
      };

      if (res.statusCode >= 500) {
        logger.error('HTTP request finalizada com erro.', baseContext);
      } else if (res.statusCode >= 400) {
        logger.warn('HTTP request finalizada com warning.', baseContext);
      } else {
        logger.info('HTTP request finalizada.', baseContext);
      }
    });

    next();
  });

  app.get('/health', (req, res) => {
    const metrics = getSocketMetrics();
    res.status(200).json({
      status: 'ok',
      requestId: req.requestId,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      metrics,
    });
  });

  app.get('/ready', (req, res) => {
    const ready = admin.apps.length > 0;
    const metrics = getSocketMetrics();

    if (!ready) {
      logger.warn('Readiness check falhou.', { requestId: req.requestId });
      res.status(503).json({
        status: 'not_ready',
        requestId: req.requestId,
        metrics,
      });
      return;
    }

    res.status(200).json({
      status: 'ready',
      requestId: req.requestId,
      metrics,
      redactionPolicy: SENSITIVE_KEYS,
    });
  });
}

async function bootstrap() {
  let serviceAccount;
  try {
    serviceAccount = carregarCredenciaisFirebase();
    validarCredenciais(serviceAccount);
  } catch (error) {
    logger.error('Falha na inicialização das credenciais Firebase.', { error });
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
    const requestId = socket.handshake?.headers?.['x-request-id'] || createRequestId();
    socket.requestId = requestId;
    const handshakeProtocolVersion = socket.handshake?.auth?.protocolVersion;
    const protocolVersion =
      typeof handshakeProtocolVersion === 'string' && handshakeProtocolVersion.trim().length > 0
        ? handshakeProtocolVersion.trim()
        : LEGACY_PROTOCOL_VERSION;
    socket.protocolVersion = protocolVersion;

    const token = socket.handshake?.auth?.token;
    if (!token || typeof token !== 'string') {
      logger.warn('Handshake de socket sem token válido.', { requestId, socketId: socket.id });
      socket.authError = 'Token de autenticação ausente ou inválido.';
      return next();
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      socket.user = {
        uid: decodedToken.uid,
      };
      logger.info('Handshake de socket autenticado.', {
        requestId,
        socketId: socket.id,
        userId: socket.user.uid,
        protocolVersion,
      });

      if (protocolVersion === LEGACY_PROTOCOL_VERSION) {
        logger.warn('Cliente conectado sem protocolVersion no handshake. Usando modo legado.', {
          requestId,
          socketId: socket.id,
          userId: socket.user.uid,
          protocolVersion,
          serverProtocolVersion: CURRENT_PROTOCOL_VERSION,
        });
      }

      return next();
    } catch (error) {
      logger.warn('Falha ao validar token no handshake do socket.', {
        requestId,
        socketId: socket.id,
        error,
      });
      socket.authError = 'Token de autenticação inválido ou expirado.';
      return next();
    }
  });

  await gerenciarSockets.carregarPartidasRecuperaveis(db, logger);
  gerenciarSockets.iniciarLimpezaPeriodica(db, logger);
  gerenciarSockets(io, db, logger);

  configurarObservabilidadeHttp(app, gerenciarSockets.getMetrics);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    logger.info('Servidor de jogo inicializado.', { port: PORT });
  });
}

bootstrap().catch((error) => {
  logger.error('Falha fatal ao iniciar o servidor.', { error });
  process.exit(1);
});
