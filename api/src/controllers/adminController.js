const { db } = require('../database/database');

function online(ultimaLeitura) {
  if (!ultimaLeitura) return false;
  return Date.now() - new Date(`${ultimaLeitura}Z`).getTime() <= 120000;
}

async function obterResumo(req, res) {
  try {
    const [usuarios, dispositivos, leituras, comandos] = await Promise.all([
      db.execute(`SELECT COUNT(*) AS total FROM usuarios`),
      db.execute(`SELECT d.id, d.nome, d.codigo, d.usuario_id, d.firmware_configurado, d.ultima_leitura, d.versao_firmware, u.nome AS dono FROM dispositivos d LEFT JOIN usuarios u ON u.id = d.usuario_id ORDER BY d.id DESC`),
      db.execute(`SELECT COUNT(*) AS total FROM leituras`),
      db.execute(`SELECT COUNT(*) AS total FROM comandos WHERE executado = 0`),
    ]);

    const lista = dispositivos.rows.map((dispositivo) => ({
      ...dispositivo,
      online: online(dispositivo.ultima_leitura),
    }));

    res.json({
      totais: {
        usuarios: Number(usuarios.rows[0].total),
        dispositivos: lista.length,
        leituras: Number(leituras.rows[0].total),
        comandosPendentes: Number(comandos.rows[0].total),
        online: lista.filter((dispositivo) => dispositivo.online).length,
        offline: lista.filter((dispositivo) => !dispositivo.online).length,
      },
      dispositivos: lista,
    });
  } catch (err) {
    console.error('Erro ao obter resumo administrativo:', err);
    res.status(500).json({ erro: 'Erro ao carregar resumo administrativo.' });
  }
}

async function limparBanco(req, res) {
  if (req.body?.confirmacao !== 'LIMPAR_BANCO') {
    return res.status(400).json({ erro: 'Digite LIMPAR_BANCO para confirmar.' });
  }

  try {
    await db.execute(`DELETE FROM comandos`);
    await db.execute(`DELETE FROM leituras`);
    await db.execute(`DELETE FROM dispositivos`);
    await db.execute(`DELETE FROM configuracoes`);
    await db.execute({
      sql: `DELETE FROM usuarios WHERE id != ?`,
      args: [req.usuario.id],
    });

    try {
      await db.execute(`DELETE FROM sqlite_sequence WHERE name IN ('comandos', 'leituras', 'dispositivos', 'configuracoes')`);
    } catch (sequenceError) {
      console.warn('Nao foi possivel reiniciar sequencias:', sequenceError.message);
    }

    res.json({ mensagem: 'Banco limpo. A conta admin atual foi preservada.' });
  } catch (err) {
    console.error('Erro ao limpar banco:', err);
    res.status(500).json({ erro: 'Erro ao limpar banco.' });
  }
}

module.exports = { obterResumo, limparBanco };
