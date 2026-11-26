const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'test-only-secret';
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

  const autenticado = new Promise(resolve => socket.once('message', resolve));
  socket.send(JSON.stringify({ token: jwt.sign({ id: 7, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' }) }));
  await autenticado;
  assert.equal(broadcastStatusUpdate({ dispositivoId: 42 }, 8), 0);
  const mensagem = await new Promise((resolve, reject) => {
    socket.once('message', (dados) => {
      try {
        resolve(JSON.parse(dados.toString()));
      } catch (erro) {
        reject(erro);
      }
    });

    broadcastStatusUpdate({ dispositivoId: 42, bomba: true }, 7);
  });

  assert.deepEqual(mensagem, {
    type: 'status-update',
    payload: { dispositivoId: 42, bomba: true },
  });

  socket.close();
  await new Promise((resolve) => server.close(resolve));
});
