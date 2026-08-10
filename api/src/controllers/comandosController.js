const { db } = require('../database/database');
const { usuarioPodeAcessarDispositivo } = require('../middleware/deviceAccess');

// POST /api/comando - usuario autenticado manda um comando para um dispositivo
async function criarComando(req, res) {
  const { bomba, dispositivoId } = req.body;

  if (typeof bomba !== 'boolean') {
    return res.status(400).json({ erro: 'Campo "bomba" deve ser boolean.' });
  }

  try {
    // Se veio dispositivoId, confere se o usuario e dono (ou admin)
    if (dispositivoId) {
      const disp = await db.execute({
        sql: `SELECT usuario_id FROM dispositivos WHERE id = ?`,
        args: [dispositivoId],
      });

      if (disp.rows.length === 0) {
        return res.status(404).json({ erro: 'Dispositivo nao encontrado.' });
      }

      if (!usuarioPodeAcessarDispositivo(req.usuario, disp.rows[0].usuario_id)) {
        return res.status(403).json({ erro: 'Voce nao tem permissao sobre esse dispositivo.' });
      }
    }

    await db.execute({
      sql: `INSERT INTO comandos (bomba, executado, dispositivo_id) VALUES (?, 0, ?)`,
      args: [bomba ? 1 : 0, dispositivoId || null],
    });

    res.status(201).json({ mensagem: 'Comando registrado com sucesso.' });
  } catch (err) {
    console.error('Erro ao criar comando:', err);
    res.status(500).json({ erro: 'Erro ao registrar comando.' });
  }
}

// GET /api/comando?codigo=SB-XXXX - ESP32 verifica se ha comando pendente para ele
async function obterComandoPendente(req, res) {
  try {
    const codigo = req.query.codigo;
    if (!codigo) {
      return res.status(400).json({ erro: 'Codigo de dispositivo obrigatorio.' });
    }
    let dispositivoId = null;

    if (codigo) {
      const disp = await db.execute({
        sql: `SELECT id FROM dispositivos WHERE codigo = ?`,
        args: [codigo],
      });
      if (disp.rows.length === 0) {
        return res.status(404).json({ erro: 'Codigo de dispositivo nao reconhecido.' });
      }
      dispositivoId = disp.rows[0].id;
    }

    const resultado = await db.execute({
      sql: `SELECT id, bomba FROM comandos WHERE executado = 0 AND dispositivo_id = ? ORDER BY id DESC LIMIT 1`,
      args: [dispositivoId],
    });

    if (resultado.rows.length === 0) {
      return res.json({ bomba: null });
    }

    const comando = resultado.rows[0];
    res.json({ id: comando.id, bomba: Boolean(comando.bomba) });
  } catch (err) {
    console.error('Erro ao buscar comando:', err);
    res.status(500).json({ erro: 'Erro ao buscar comando.' });
  }
}

// POST /api/comando/:id/concluido - ESP32 confirma que executou o comando
async function marcarComandoExecutado(req, res) {
  const { id } = req.params;

  try {
    await db.execute({
      sql: `UPDATE comandos SET executado = 1 WHERE id = ?`,
      args: [id],
    });

    res.json({ mensagem: 'Comando marcado como executado.' });
  } catch (err) {
    console.error('Erro ao marcar comando como executado:', err);
    res.status(500).json({ erro: 'Erro ao atualizar comando.' });
  }
}

module.exports = { criarComando, obterComandoPendente, marcarComandoExecutado };
