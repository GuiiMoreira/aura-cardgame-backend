const fs = require('fs');
const vm = require('vm');

let ioFactory = null;

function getIoFactory() {
  if (ioFactory) return ioFactory;

  const path = require('path');
  const socketIoRoot = path.resolve(require.resolve('socket.io'), '..', '..');
  const clientScript = fs.readFileSync(
    path.join(socketIoRoot, 'client-dist', 'socket.io.js'),
    'utf8'
  );
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    WebSocket,
    fetch,
    Headers,
    Request,
    Response,
    TextEncoder,
    TextDecoder,
    AbortController,
    Blob,
    File,
    FormData,
    URL,
    URLSearchParams,
    location: { protocol: 'http:', host: 'localhost', port: '80' },
    navigator: { userAgent: 'node' },
  };

  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(clientScript, sandbox);
  ioFactory = sandbox.io;

  return ioFactory;
}

module.exports = {
  io: (...args) => getIoFactory()(...args),
};
