const bcrypt = require('bcryptjs');
const { db } = require('../database/database');

// GET /api/usuarios - somente admin
async function listarUsuarios(req, res) {
  try {
    const resultado = await db.execute(
      `SELECT id, nome, email, role FROM usuarios ORDER BY id DESC`
    );
    res.json(resultado.rows);
  } catch (err) {
    console.error('Erro ao listar usuarios:', err);
    res.status(500).json({ erro: 'Erro ao listar usuarios.' });
  }
}

// POST /api/usuarios - somente admin
async function criarUsuario(req, res) {
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

    res.status(201).json({ mensagem: `Usuario ${usuario} criado com sucesso.` });
  } catch (err) {
    console.error('Erro ao criar usuario:', err);
    res.status(500).json({ erro: 'Erro ao criar usuario. Talvez o usuario ja exista.' });
  }
}

// DELETE /api/usuarios/:id - somente admin, nao pode apagar o proprio usuario logado
async function removerUsuario(req, res) {
  const { id } = req.params;

  if (Number(id) === Number(req.usuario.id)) {
    return res.status(400).json({ erro: 'Voce nao pode apagar o proprio usuario logado.' });
  }

  try {
    const usuario = await db.execute({
      sql: `SELECT id FROM usuarios WHERE id = ?`,
      args: [id],
    });

    if (usuario.rows.length === 0) {
      return res.status(404).json({ erro: 'Usuario nao encontrado.' });
    }

    await db.execute({ sql: `DELETE FROM usuarios WHERE id = ?`, args: [id] });

    res.json({ mensagem: 'Usuario removido com sucesso.' });
  } catch (err) {
    console.error('Erro ao remover usuario:', err);
    res.status(500).json({ erro: 'Erro ao remover usuario.' });
  }
}

module.exports = { listarUsuarios, criarUsuario, removerUsuario };
