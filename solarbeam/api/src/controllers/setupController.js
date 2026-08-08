const bcrypt = require('bcryptjs');
const { db } = require('../database/database');

// Endpoint TEMPORARIO protegido por senha secreta (SETUP_SECRET no .env).
// Use para criar o primeiro admin, depois REMOVA esta rota do app.js.
async function criarUsuarioInicial(req, res) {
  const segredoRecebido = req.headers['x-setup-secret'];

  if (!segredoRecebido || segredoRecebido !== process.env.SETUP_SECRET) {
    return res.status(403).json({ erro: 'Nao autorizado.' });
  }

  const { nome, usuario, senha, role } = req.body;

  if (!nome || !usuario || !senha) {
    return res.status(400).json({ erro: 'nome, usuario e senha sao obrigatorios.' });
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
