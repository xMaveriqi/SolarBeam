const crypto = require('crypto');
const { db } = require('../database/database');

function gerarCodigo() {
  // Codigo curto e unico, ex: SB-A1B2C3D4
  return 'SB-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

// GET /api/dispositivos - lista os dispositivos do usuario logado
// Admin pode ver todos passando ?todos=true
async function listarDispositivos(req, res) {
  try {
    const verTodos = req.query.todos === 'true' && req.usuario.role === 'admin';

    const resultado = verTodos
      ? await db.execute(`
          SELECT d.id, d.nome, d.codigo, d.criado_em, u.email AS dono
          FROM dispositivos d
          JOIN usuarios u ON u.id = d.usuario_id
          ORDER BY d.id DESC
        `)
      : await db.execute({
          sql: `SELECT id, nome, codigo, criado_em FROM dispositivos WHERE usuario_id = ? ORDER BY id DESC`,
          args: [req.usuario.id],
        });

    res.json(resultado.rows);
  } catch (err) {
    console.error('Erro ao listar dispositivos:', err);
    res.status(500).json({ erro: 'Erro ao listar dispositivos.' });
  }
}

// POST /api/dispositivos - cria um novo dispositivo (ESP32) para o usuario logado
async function criarDispositivo(req, res) {
  const { nome } = req.body;

  if (!nome) {
    return res.status(400).json({ erro: 'Nome do dispositivo e obrigatorio.' });
  }

  try {
    let codigo;
    let tentativas = 0;

    // Gera codigo e garante que e unico (raro colidir, mas confere)
    while (tentativas < 5) {
      codigo = gerarCodigo();
      const existe = await db.execute({
        sql: `SELECT id FROM dispositivos WHERE codigo = ?`,
        args: [codigo],
      });
      if (existe.rows.length === 0) break;
      tentativas++;
    }

    await db.execute({
      sql: `INSERT INTO dispositivos (nome, codigo, usuario_id) VALUES (?, ?, ?)`,
      args: [nome, codigo, req.usuario.id],
    });

    res.status(201).json({
      mensagem: 'Dispositivo criado com sucesso.',
      codigo,
      instrucao: 'Grave esse codigo no firmware do ESP32 (variavel DEVICE_CODE) para vincular as leituras a este dispositivo.',
    });
  } catch (err) {
    console.error('Erro ao criar dispositivo:', err);
    res.status(500).json({ erro: 'Erro ao criar dispositivo.' });
  }
}

// PATCH /api/dispositivos/:id - renomeia um dispositivo (so o dono)
async function renomearDispositivo(req, res) {
  const { id } = req.params;
  const { nome } = req.body;

  if (!nome) {
    return res.status(400).json({ erro: 'Nome e obrigatorio.' });
  }

  try {
    const dispositivo = await db.execute({
      sql: `SELECT id, usuario_id FROM dispositivos WHERE id = ?`,
      args: [id],
    });

    if (dispositivo.rows.length === 0) {
      return res.status(404).json({ erro: 'Dispositivo nao encontrado.' });
    }

    const dono = dispositivo.rows[0].usuario_id;
    if (dono !== req.usuario.id && req.usuario.role !== 'admin') {
      return res.status(403).json({ erro: 'Voce nao tem permissao para editar esse dispositivo.' });
    }

    await db.execute({
      sql: `UPDATE dispositivos SET nome = ? WHERE id = ?`,
      args: [nome, id],
    });

    res.json({ mensagem: 'Dispositivo renomeado com sucesso.' });
  } catch (err) {
    console.error('Erro ao renomear dispositivo:', err);
    res.status(500).json({ erro: 'Erro ao renomear dispositivo.' });
  }
}

// DELETE /api/dispositivos/:id - remove um dispositivo (so o dono)
async function removerDispositivo(req, res) {
  const { id } = req.params;

  try {
    const dispositivo = await db.execute({
      sql: `SELECT id, usuario_id FROM dispositivos WHERE id = ?`,
      args: [id],
    });

    if (dispositivo.rows.length === 0) {
      return res.status(404).json({ erro: 'Dispositivo nao encontrado.' });
    }

    const dono = dispositivo.rows[0].usuario_id;
    if (dono !== req.usuario.id && req.usuario.role !== 'admin') {
      return res.status(403).json({ erro: 'Voce nao tem permissao para remover esse dispositivo.' });
    }

    await db.execute({ sql: `DELETE FROM dispositivos WHERE id = ?`, args: [id] });

    res.json({ mensagem: 'Dispositivo removido com sucesso.' });
  } catch (err) {
    console.error('Erro ao remover dispositivo:', err);
    res.status(500).json({ erro: 'Erro ao remover dispositivo.' });
  }
}

module.exports = { listarDispositivos, criarDispositivo, renomearDispositivo, removerDispositivo };
