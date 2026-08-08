const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    mensagem: 'Ola Mundo! API de irrigacao no ar.',
    status: 'online'
  });
});

app.use('/api/sensores', require('./routes/sensores'));
app.use('/api/status', require('./routes/status'));
app.use('/api/login', require('./routes/auth'));
app.use('/api/historico', require('./routes/historico'));
app.use('/api/comando', require('./routes/comandos'));
app.use('/api/config', require('./routes/configuracoes'));
app.use('/api/setup-usuario', require('./routes/setup'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/dispositivos', require('./routes/dispositivos'));

app.use((req, res) => {
  res.status(404).json({ erro: 'Rota nao encontrada' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

module.exports = app;
