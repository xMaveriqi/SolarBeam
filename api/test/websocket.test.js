const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { WebSocket } = require('ws');

const { setupWebSocketServer, broadcastStatusUpdate } = require('../src/websocket');

test('broadcastStatusUpdate envia evento para clientes conectados', async () => {
  const server = http.createServer();
  setupWebSocketServer(server);

  await new Promise((resolve) => server.listen(0, resolve));

  const port = server.address().port;
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);

  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });

  const mensagem = await new Promise((resolve, reject) => {
    socket.once('message', (dados) => {
      try {
        resolve(JSON.parse(dados.toString()));
      } catch (erro) {
        reject(erro);
      }
    });

    broadcastStatusUpdate({ dispositivoId: 42, bomba: true });
  });

  assert.deepEqual(mensagem, {
    type: 'status-update',
    payload: { dispositivoId: 42, bomba: true },
  });

  socket.close();
  await new Promise((resolve) => server.close(resolve));
});
