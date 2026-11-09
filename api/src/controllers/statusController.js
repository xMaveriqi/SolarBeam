const { db } = require('../database/database');
const { usuarioPodeAcessarDispositivo } = require('../middleware/deviceAccess');

function paraHorarioBrasilia(dataHoraUTC) {
  if (!dataHoraUTC) return '--';

  const dataNormalizada = String(dataHoraUTC).replace(' ', 'T');
  const dataUTC = new Date(`${dataNormalizada}Z`);

  if (Number.isNaN(dataUTC.getTime())) {
    return '--';
  }

  const dataBrasil = new Date(dataUTC.getTime() - 3 * 60 * 60 * 1000);

  const pad = (n) => String(n).padStart(2, '0');
  const y = dataBrasil.getUTCFullYear();
  const m = pad(dataBrasil.getUTCMonth() + 1);
  const d = pad(dataBrasil.getUTCDate());
  const h = pad(dataBrasil.getUTCHours());
  const min = pad(dataBrasil.getUTCMinutes());
  const s = pad(dataBrasil.getUTCSeconds());

  return `${y}-${m}-${d} ${h}:${min}:${s}`;
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
      sql: `SELECT umidade, nivel_agua, bateria, bomba, temperatura, umidade_ar, data_hora, versao_firmware
            FROM leituras WHERE dispositivo_id = ?
            ORDER BY id DESC LIMIT 1`,
      args: [dispositivoId],
    });

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Nenhuma leitura encontrada.' });
    }

    const leitura = resultado.rows[0];

    const dataLeituraMs = Number.isFinite(Date.parse(String(leitura.data_hora).replace(' ', 'T'))) ?
      new Date(`${String(leitura.data_hora).replace(' ', 'T')}Z`).getTime() :
      NaN;
    const online = Number.isFinite(dataLeituraMs) && (Date.now() - dataLeituraMs <= 120000);

    const bateriaPercentual = Math.max(
      0,
      Math.min(100, Math.round(((leitura.bateria - 3) / 1.2) * 100))
    );

    // O ESP só pode ser considerado conectado aos serviços enquanto existe
    // uma leitura recente. Assim, um ESP offline nunca aparece como Wi-Fi
    // conectado ou energia solar ativa na dashboard.
    const wifi = online;
    const energiaSolar = online && Number(leitura.bateria) > 3.0;

    res.json({
      umidade: leitura.umidade,
      nivelAgua: leitura.nivel_agua,
      bateria: leitura.bateria,
      bateriaPercentual,
      autonomiaEstimada: bateriaPercentual > 0 ? `${Math.max(1, Math.round(bateriaPercentual / 8))}h` : '--',
      bomba: normalizarEstadoBomba(leitura.bomba),
      temperatura: leitura.temperatura,
      umidadeAr: leitura.umidade_ar,
      versaoFirmware: leitura.versao_firmware,
      online,
      wifi,
      energiaSolar,
      ultimaAtualizacaoMs: dataLeituraMs,
      ultimaAtualizacao: paraHorarioBrasilia(leitura.data_hora),
    });
  } catch (err) {
    console.error('Erro ao buscar status:', err);
    res.status(500).json({ erro: 'Erro ao buscar status no banco.' });
  }
}

module.exports = { obterStatus, normalizarEstadoBomba, paraHorarioBrasilia };
