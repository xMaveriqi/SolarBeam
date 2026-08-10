const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db } = require('../database/database');

function segredoValido(recebido) {
  const esperado = process.env.SETUP_SECRET;
  if (!esperado || !recebido) return false;

  const bufRecebido = Buffer.from(recebido);
  const bufEsperado = Buffer.from(esperado);

  // timingSafeEqual exige buffers do mesmo tamanho
  if (bufRecebido.length !== bufEsperado.length) return false;

  return crypto.timingSafeEqual(bufRecebido, bufEsperado);
}

// Endpoint TEMPORARIO protegido por senha secreta (SETUP_SECRET no .env).
// Use para criar o primeiro admin, depois REMOVA a rota /api/setup-usuario do app.js
// e apague a variavel SETUP_SECRET do Render.
async function criarUsuarioInicial(req, res) {
  const segredoRecebido = req.headers['x-setup-secret'] || '';

  if (!segredoValido(segredoRecebido)) {
    return res.status(403).json({ erro: 'Nao autorizado.' });
  }

  const { nome, usuario, senha, role } = req.body;

  if (!nome || !usuario || !senha) {
    return res.status(400).json({ erro: 'nome, usuario e senha sao obrigatorios.' });
  }

  if (senha.length < 4) {
    return res.status(400).json({ erro: 'Senha muito curta.' });
  }

  const papel = role === 'admin' ? 'admin' : 'user';

  try {
    const senhaHash = await bcrypt.hash(senha, 10);

    await db.execute({
      sql: `INSERT INTO usuarios (nome, email, senha, role) VALUES (?, ?, ?, ?)`,
      args: [nome, usuario, senhaHash, papel],
    });

    res.status(201).json({ mensagem: `Usuario ${usuario} (${papel}) criado com sucesso.` });
  } catch (err) {
    console.error('Erro ao criar usuario inicial:', err);
    res.status(500).json({ erro: 'Erro ao criar usuario. Talvez o usuario ja exista.' });
  }
}

module.exports = { criarUsuarioInicial };
