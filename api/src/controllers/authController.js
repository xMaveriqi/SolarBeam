const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database/database');

async function login(req, res) {
  const { usuario, senha } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ erro: 'Usuario e senha sao obrigatorios.' });
  }

  try {
    const resultado = await db.execute({
      sql: `SELECT id, nome, email, senha, role FROM usuarios WHERE email = ?`,
      args: [usuario],
    });

    if (resultado.rows.length === 0) {
      return res.status(401).json({ erro: 'Usuario ou senha invalidos.' });
    }

    const registro = resultado.rows[0];
    const senhaValida = await bcrypt.compare(senha, registro.senha);

    if (!senhaValida) {
      return res.status(401).json({ erro: 'Usuario ou senha invalidos.' });
    }

    const token = jwt.sign(
      { id: registro.id, usuario: registro.email, nome: registro.nome, role: registro.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, role: registro.role, nome: registro.nome, id: registro.id });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ erro: 'Erro interno ao fazer login.' });
  }
}

module.exports = { login };
