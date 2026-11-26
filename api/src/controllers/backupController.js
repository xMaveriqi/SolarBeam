const { db } = require('../database/database');

async function exportarBackup(req, res) {
  try {
    const [usuarios, dispositivos, leituras, comandos] = await Promise.all([
      db.execute(`SELECT id, nome, email, role FROM usuarios ORDER BY id`),
      db.execute(`SELECT id, nome, codigo, usuario_id, criado_em, firmware_configurado, ultima_leitura, versao_firmware, token_dispositivo FROM dispositivos ORDER BY id`),
      db.execute(`SELECT id, umidade, nivel_agua, bateria, bomba, dispositivo_id, versao_firmware, data_hora FROM leituras ORDER BY id`),
      db.execute(`SELECT id, bomba, executado, dispositivo_id, data_hora FROM comandos ORDER BY id`),
    ]);

    res.json({
      exportadoEm: new Date().toISOString(),
      usuarios: usuarios.rows,
      dispositivos: dispositivos.rows,
      leituras: leituras.rows,
      comandos: comandos.rows,
    });
  } catch (err) {
    console.error('Erro ao exportar backup:', err);
    res.status(500).json({ erro: 'Erro ao exportar backup.' });
  }
}

module.exports = { exportarBackup };
