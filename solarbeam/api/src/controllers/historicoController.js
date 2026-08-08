const { db } = require('../database/database');

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
    const resultado = dispositivoId
      ? await db.execute({
          sql: `SELECT id, umidade, nivel_agua, bateria, bomba, data_hora
                FROM leituras WHERE dispositivo_id = ?
                ORDER BY id DESC LIMIT ?`,
          args: [dispositivoId, limite],
        })
      : await db.execute({
          sql: `SELECT id, umidade, nivel_agua, bateria, bomba, data_hora
                FROM leituras ORDER BY id DESC LIMIT ?`,
          args: [limite],
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
