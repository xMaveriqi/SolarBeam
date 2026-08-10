const { db } = require('../database/database');
const { usuarioPodeAcessarDispositivo } = require('../middleware/deviceAccess');

function paraHorarioBrasilia(dataHoraUTC) {
  const dataUTC = new Date(dataHoraUTC + 'Z');
  const dataBrasil = new Date(dataUTC.getTime() - 3 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${dataBrasil.getFullYear()}-${pad(dataBrasil.getMonth() + 1)}-${pad(dataBrasil.getDate())} ${pad(dataBrasil.getHours())}:${pad(dataBrasil.getMinutes())}:${pad(dataBrasil.getSeconds())}`;
}

// GET /api/historico?limite=50&dispositivo=ID
async function obterHistorico(req, res) {
  const limite = Math.min(parseInt(req.query.limite) || 50, 500);
  const dispositivoId = req.query.dispositivo;

  try {
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
      sql: `SELECT id, umidade, nivel_agua, bateria, bomba, data_hora
            FROM leituras WHERE dispositivo_id = ?
            ORDER BY id DESC LIMIT ?`,
      args: [dispositivoId, limite],
    });

    const historico = resultado.rows.map((l) => ({
      id: l.id,
      umidade: l.umidade,
      nivelAgua: l.nivel_agua,
      bateria: l.bateria,
      bomba: Boolean(l.bomba),
      dataHora: paraHorarioBrasilia(l.data_hora),
    }));

    res.json(historico);
  } catch (err) {
    console.error('Erro ao buscar historico:', err);
    res.status(500).json({ erro: 'Erro ao buscar historico no banco.' });
  }
}

module.exports = { obterHistorico };
