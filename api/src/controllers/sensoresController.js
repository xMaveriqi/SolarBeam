const { db } = require('../database/database');

async function receberLeitura(req, res) {
  const { umidade, nivelAgua, bateria, bomba, codigoDispositivo } = req.body;

  if (
    typeof umidade !== 'number' ||
    typeof nivelAgua !== 'number' ||
    typeof bateria !== 'number' ||
    typeof bomba !== 'boolean'
  ) {
    return res.status(400).json({
      erro: 'Dados invalidos. Esperado: umidade (number), nivelAgua (number), bateria (number), bomba (boolean).',
    });
  }

  try {
    let dispositivoId = null;

    // codigoDispositivo e opcional (compatibilidade com testes/simulador antigo)
    if (codigoDispositivo) {
      const dispositivo = await db.execute({
        sql: `SELECT id FROM dispositivos WHERE codigo = ?`,
        args: [codigoDispositivo],
      });

      if (dispositivo.rows.length === 0) {
        return res.status(404).json({ erro: 'Codigo de dispositivo nao reconhecido.' });
      }

      dispositivoId = dispositivo.rows[0].id;
    }

    await db.execute({
      sql: `INSERT INTO leituras (umidade, nivel_agua, bateria, bomba, dispositivo_id) VALUES (?, ?, ?, ?, ?)`,
      args: [umidade, nivelAgua, bateria, bomba ? 1 : 0, dispositivoId],
    });

    res.status(201).json({ mensagem: 'Leitura salva com sucesso.' });
  } catch (err) {
    console.error('Erro ao salvar leitura:', err);
    res.status(500).json({ erro: 'Erro ao salvar leitura no banco.' });
  }
}

module.exports = { receberLeitura };
