require('dotenv').config();

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'solarbeam-dev-secret-change-me';
}

const http = require('http');
const app = require('./app');
const { initDatabase } = require('./database/database');
const { setupWebSocketServer } = require('./websocket');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await initDatabase();

    const server = http.createServer(app);
    setupWebSocketServer(server);

    server.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      console.log(`WebSocket ativo em ws://localhost:${PORT}/ws`);
    });
  } catch (err) {
    console.error('Falha ao inicializar o banco de dados:', err);
    process.exit(1);
  }
}

start();
