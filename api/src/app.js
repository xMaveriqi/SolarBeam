const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet());

// CORS restrito as origens conhecidas do frontend (Netlify + testes locais).
// Configure ORIGENS_PERMITIDAS no .env como lista separada por virgula se
// tiver mais de um dominio (ex: https://solarbeam.netlify.app,http://localhost:5500).
const origensPermitidas = (process.env.ORIGENS_PERMITIDAS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Sem origin = chamada direta (curl, ESP32, Postman) - permitido.
    if (!origin || origensPermitidas.length === 0 || origensPermitidas.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Origem nao permitida pelo CORS'));
  },
}));

app.use(morgan('dev'));
app.use(express.json());

// Limita tentativas de login para dificultar forca bruta
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: { erro: 'Muitas tentativas de login. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite geral mais folgado para o resto da API
const limiteGeral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiteGeral);

app.get('/', (req, res) => {
  res.json({
    mensagem: 'Ola Mundo! API de irrigacao no ar.',
    status: 'online'
  });
});

app.use('/api/login', limiteLogin, require('./routes/auth'));
app.use('/api/sensores', require('./routes/sensores'));
app.use('/api/status', require('./routes/status'));
app.use('/api/historico', require('./routes/historico'));
app.use('/api/comando', require('./routes/comandos'));
app.use('/api/config', require('./routes/configuracoes'));
app.use('/api/setup-usuario', limiteLogin, require('./routes/setup'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/dispositivos', require('./routes/dispositivos'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/admin', require('./routes/admin'));

app.use((req, res) => {
  res.status(404).json({ erro: 'Rota nao encontrada' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

module.exports = app;
