const { randomUUID } = require('crypto');

const SENSITIVE_KEYS = [
  'authorization',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'private_key',
  'client_email',
  'GOOGLE_CREDENTIALS_BASE64',
];

const LEVELS = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
};

function maskSensitive(value) {
  if (Array.isArray(value)) {
    return value.map(maskSensitive);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.entries(value).reduce((acc, [key, nestedValue]) => {
    if (SENSITIVE_KEYS.includes(key)) {
      acc[key] = '[REDACTED]';
      return acc;
    }

    acc[key] = maskSensitive(nestedValue);
    return acc;
  }, {});
}

function normalizeError(error) {
  if (!error) return undefined;
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

function formatLog(level, message, context = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level: LEVELS[level] || LEVELS.info,
    message,
    ...maskSensitive(context),
  };

  return JSON.stringify(payload);
}

function log(level, message, context = {}) {
  const output = formatLog(level, message, context);
  if (level === 'error') {
    console.error(output);
    return;
  }

  if (level === 'warn') {
    console.warn(output);
    return;
  }

  console.log(output);
}

function createChildLogger(baseContext = {}) {
  return {
    info(message, context = {}) {
      log('info', message, { ...baseContext, ...context });
    },
    warn(message, context = {}) {
      log('warn', message, { ...baseContext, ...context });
    },
    error(message, context = {}) {
      const data = { ...baseContext, ...context };
      if (data.error instanceof Error) {
        data.error = normalizeError(data.error);
      }
      log('error', message, data);
    },
    child(context = {}) {
      return createChildLogger({ ...baseContext, ...context });
    },
    getSensitiveKeys() {
      return [...SENSITIVE_KEYS];
    },
  };
}

function createRequestId() {
  return randomUUID();
}

module.exports = {
  logger: createChildLogger(),
  createRequestId,
  SENSITIVE_KEYS,
};
