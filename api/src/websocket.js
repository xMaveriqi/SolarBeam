const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { usuarioPodeAcessarDispositivo } = require('./middleware/deviceAccess');

let wss = null;

function setupWebSocketServer(server) {
  if (!server || wss) return wss;

  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', cliente => {
    const timer = setTimeout(() => cliente.close(1008, 'Autenticacao obrigatoria'), 5000);
    cliente.on('close', () => clearTimeout(timer));
    cliente.on('error', () => cliente.terminate());
    cliente.once('message', dados => {
      try {
        cliente.usuario = jwt.verify(JSON.parse(dados.toString()).token, process.env.JWT_SECRET);
        clearTimeout(timer);
        cliente.send(JSON.stringify({ type: 'authenticated' }));
      } catch {
        cliente.close(1008, 'Token invalido');
      }
    });
  });
  wss.on('close', () => { wss = null; });

  return wss;
}

function broadcastMessage(message, donoId) {
  if (!wss) return 0;

  let enviadas = 0;

  for (const cliente of wss.clients) {
    if (cliente.readyState === WebSocket.OPEN && cliente.usuario &&
        cliente.usuario.exp > Date.now() / 1000 && donoId != null &&
        usuarioPodeAcessarDispositivo(cliente.usuario, donoId)) {
      cliente.send(JSON.stringify(message));
      enviadas += 1;
    }
  }

  return enviadas;
}

function broadcastStatusUpdate(payload, donoId) {
  return broadcastMessage({
    type: 'status-update',
    payload,
  }, donoId);
}

function broadcastEvent(type, payload, donoId) {
  return broadcastMessage({
    type,
    payload,
  }, donoId);
}

module.exports = {
  setupWebSocketServer,
  broadcastMessage,
  broadcastStatusUpdate,
  broadcastEvent,
};
