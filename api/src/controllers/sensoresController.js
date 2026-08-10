const { db } = require('../database/database');

async function receberLeitura(req, res) {
  const { umidade, nivelAgua, bateria, bomba, codigoDispositivo, tokenDispositivo, versaoFirmware } = req.body;

  if (
    !codigoDispositivo ||
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

    const dispositivo = await db.execute({
      sql: `SELECT id, token_dispositivo FROM dispositivos WHERE codigo = ?`,
      args: [codigoDispositivo],
    });

    if (dispositivo.rows.length === 0) {
      return res.status(404).json({ erro: 'Codigo de dispositivo nao reconhecido.' });
    }

    if (dispositivo.rows[0].token_dispositivo && dispositivo.rows[0].token_dispositivo !== tokenDispositivo) {
      return res.status(401).json({ erro: 'Token do dispositivo invalido.' });
    }

    dispositivoId = dispositivo.rows[0].id;

    await db.execute({
      sql: `INSERT INTO leituras (umidade, nivel_agua, bateria, bomba, dispositivo_id, versao_firmware) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [umidade, nivelAgua, bateria, bomba ? 1 : 0, dispositivoId, versaoFirmware || null],
    });

    await db.execute({
      sql: `UPDATE dispositivos SET firmware_configurado = 1, ultima_leitura = datetime('now'), versao_firmware = ? WHERE id = ?`,
      args: [versaoFirmware || null, dispositivoId],
    });

    res.status(201).json({ mensagem: 'Leitura salva com sucesso.' });
  } catch (err) {
    console.error('Erro ao salvar leitura:', err);
    res.status(500).json({ erro: 'Erro ao salvar leitura no banco.' });
  }
}

module.exports = { receberLeitura };
