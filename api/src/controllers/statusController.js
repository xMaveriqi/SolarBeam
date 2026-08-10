const { db } = require('../database/database');
const { usuarioPodeAcessarDispositivo } = require('../middleware/deviceAccess');

function paraHorarioBrasilia(dataHoraUTC) {
  const dataUTC = new Date(dataHoraUTC + 'Z');
  const dataBrasil = new Date(dataUTC.getTime() - 3 * 60 * 60 * 1000);

  const pad = (n) => String(n).padStart(2, '0');
  const y = dataBrasil.getFullYear();
  const m = pad(dataBrasil.getMonth() + 1);
  const d = pad(dataBrasil.getDate());
  const h = pad(dataBrasil.getHours());
  const min = pad(dataBrasil.getMinutes());
  const s = pad(dataBrasil.getSeconds());

  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

// GET /api/status?dispositivo=ID - se omitido, pega a ultima leitura de qualquer dispositivo
async function obterStatus(req, res) {
  try {
    const dispositivoId = req.query.dispositivo;

    if (!dispositivoId) {
      return res.status(400).json({ erro: 'Informe o dispositivo.' });
    }

    const dispositivo = await db.execute({
      sql: `SELECT usuario_id FROM dispositivos WHERE id = ?`,
      args: [dispositivoId],
    });

    if (dispositivo.rows.length === 0) {
      return res.status(404).json({ erro: 'Dispositivo nao encontrado.' });
    }

    if (!usuarioPodeAcessarDispositivo(req.usuario, dispositivo.rows[0].usuario_id)) {
      return res.status(403).json({ erro: 'Voce nao tem permissao sobre esse dispositivo.' });
    }

    const resultado = await db.execute({
      sql: `SELECT umidade, nivel_agua, bateria, bomba, data_hora, versao_firmware
            FROM leituras WHERE dispositivo_id = ?
            ORDER BY id DESC LIMIT 1`,
      args: [dispositivoId],
    });

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Nenhuma leitura encontrada.' });
    }

    const leitura = resultado.rows[0];

    res.json({
      umidade: leitura.umidade,
      nivelAgua: leitura.nivel_agua,
      bateria: leitura.bateria,
      bomba: Boolean(leitura.bomba),
      versaoFirmware: leitura.versao_firmware,
      online: Date.now() - new Date(`${leitura.data_hora}Z`).getTime() <= 120000,
      ultimaAtualizacao: paraHorarioBrasilia(leitura.data_hora),
    });
  } catch (err) {
    console.error('Erro ao buscar status:', err);
    res.status(500).json({ erro: 'Erro ao buscar status no banco.' });
  }
}

module.exports = { obterStatus };
