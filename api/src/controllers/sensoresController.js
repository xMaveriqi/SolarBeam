const crypto = require('crypto');
const { db } = require('../database/database');
const { broadcastStatusUpdate } = require('../websocket');

function paraHorarioBrasilia(dataHora) {
  const data = new Date(dataHora);
  const dataBrasil = new Date(data.getTime() - 3 * 60 * 60 * 1000);
  const pad = (valor) => String(valor).padStart(2, '0');

  return `${dataBrasil.getUTCFullYear()}-${pad(dataBrasil.getUTCMonth() + 1)}-${pad(dataBrasil.getUTCDate())} ${pad(dataBrasil.getUTCHours())}:${pad(dataBrasil.getUTCMinutes())}:${pad(dataBrasil.getUTCSeconds())}`;
}

function normalizarEstadoBomba(valor) {
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return valor === 1;
  if (typeof valor === 'string') {
    const normalizado = valor.trim().toLowerCase();
    if (['1', 'true', 'on', 'yes'].includes(normalizado)) return true;
    if (['0', 'false', 'off', 'no', 'null', 'undefined', ''].includes(normalizado)) return false;
    return false;
  }
  return Boolean(valor);
}

function tokenValido(esperado, recebido) {
  if (!esperado || !recebido) return false;

  const bufEsperado = Buffer.from(esperado);
  const bufRecebido = Buffer.from(recebido);

  if (bufEsperado.length !== bufRecebido.length) return false;

  return crypto.timingSafeEqual(bufEsperado, bufRecebido);
}

async function receberLeitura(req, res) {
  const {
    umidade,
    nivelAgua,
    bateria,
    bomba,
    temperatura,
    umidadeAr,
    codigoDispositivo,
    tokenDispositivo,
    versaoFirmware,
  } = req.body;

  const bombaNormalizado = normalizarEstadoBomba(bomba);

  if (
    !codigoDispositivo ||
    typeof umidade !== 'number' ||
    typeof nivelAgua !== 'number' ||
    typeof bateria !== 'number' ||
    (bomba !== undefined && bomba !== null && typeof bomba !== 'boolean' && typeof bomba !== 'number' && typeof bomba !== 'string') ||
    (temperatura !== undefined && temperatura !== null && typeof temperatura !== 'number') ||
    (umidadeAr !== undefined && umidadeAr !== null && typeof umidadeAr !== 'number')
  ) {
    return res.status(400).json({
      erro:
        'Dados invalidos. Esperado: umidade (number), nivelAgua (number), bateria (number), bomba (boolean), ' +
        'temperatura (number, opcional), umidadeAr (number, opcional).',
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

    if (dispositivo.rows[0].token_dispositivo && !tokenValido(dispositivo.rows[0].token_dispositivo, tokenDispositivo)) {
      return res.status(401).json({ erro: 'Token do dispositivo invalido.' });
    }

    dispositivoId = dispositivo.rows[0].id;

    await db.execute({
      sql: `INSERT INTO leituras (umidade, nivel_agua, bateria, bomba, dispositivo_id, versao_firmware, temperatura, umidade_ar) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        umidade,
        nivelAgua,
        bateria,
        bombaNormalizado ? 1 : 0,
        dispositivoId,
        versaoFirmware || null,
        temperatura ?? null,
        umidadeAr ?? null,
      ],
    });

    await db.execute({
      sql: `UPDATE dispositivos SET firmware_configurado = 1, ultima_leitura = datetime('now'), versao_firmware = ? WHERE id = ?`,
      args: [versaoFirmware || null, dispositivoId],
    });

    const agora = Date.now();
    const eventoStatus = {
      dispositivoId,
      umidade,
      nivelAgua,
      bateria,
      bomba: bombaNormalizado,
      temperatura: temperatura ?? null,
      umidadeAr: umidadeAr ?? null,
      versaoFirmware: versaoFirmware || null,
      online: true,
      wifi: true,
      energiaSolar: Number(bateria) > 3.0,
      ultimaAtualizacaoMs: agora,
      ultimaAtualizacao: paraHorarioBrasilia(agora),
      bateriaPercentual: Math.max(0, Math.min(100, Math.round(((Number(bateria) - 3) / 1.2) * 100))),
    };

    broadcastStatusUpdate(eventoStatus);

    res.status(201).json({ mensagem: 'Leitura salva com sucesso.' });
  } catch (err) {
    console.error('Erro ao salvar leitura:', err);
    res.status(500).json({ erro: 'Erro ao salvar leitura no banco.' });
  }
}

module.exports = { receberLeitura, normalizarEstadoBomba };
