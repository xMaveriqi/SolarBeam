const WebSocket = require('ws');

let wss = null;

function setupWebSocketServer(server) {
  if (!server || wss) return wss;

  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', () => {
    // Sem mensagem inicial; a dashboard recebe apenas eventos reais de status.
  });

  return wss;
}

function broadcastMessage(message) {
  if (!wss) return 0;

  let enviadas = 0;

  for (const cliente of wss.clients) {
    if (cliente.readyState === WebSocket.OPEN) {
      cliente.send(JSON.stringify(message));
      enviadas += 1;
    }
  }

  return enviadas;
}

function broadcastStatusUpdate(payload) {
  return broadcastMessage({
    type: 'status-update',
    payload,
  });
}

function broadcastEvent(type, payload) {
  return broadcastMessage({
    type,
    payload,
  });
}

module.exports = {
  setupWebSocketServer,
  broadcastMessage,
  broadcastStatusUpdate,
  broadcastEvent,
};
