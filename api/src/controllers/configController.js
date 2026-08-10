const { db } = require('../database/database');

async function obterConfig(req, res) {
  try {
    let resultado = await db.execute(
      `SELECT id, umidade_minima, tempo_bomba, modo FROM configuracoes ORDER BY id DESC LIMIT 1`
    );

    if (resultado.rows.length === 0) {
      await db.execute(
        `INSERT INTO configuracoes (umidade_minima, tempo_bomba, modo) VALUES (30, 10, 'automatico')`
      );
      resultado = await db.execute(
        `SELECT id, umidade_minima, tempo_bomba, modo FROM configuracoes ORDER BY id DESC LIMIT 1`
      );
    }

    const config = resultado.rows[0];
    res.json({
      umidadeMinima: config.umidade_minima,
      tempoBomba: config.tempo_bomba,
      modo: config.modo,
    });
  } catch (err) {
    console.error('Erro ao buscar config:', err);
    res.status(500).json({ erro: 'Erro ao buscar configuracoes.' });
  }
}

async function atualizarConfig(req, res) {
  const { umidadeMinima, tempoBomba, modo } = req.body;

  if (
    typeof umidadeMinima !== 'number' ||
    typeof tempoBomba !== 'number' ||
    !['automatico', 'manual'].includes(modo)
  ) {
    return res.status(400).json({
      erro: 'Dados invalidos. Esperado: umidadeMinima (number), tempoBomba (number), modo ("automatico" ou "manual").',
    });
  }

  try {
    const existente = await db.execute(`SELECT id FROM configuracoes ORDER BY id DESC LIMIT 1`);

    if (existente.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO configuracoes (umidade_minima, tempo_bomba, modo) VALUES (?, ?, ?)`,
        args: [umidadeMinima, tempoBomba, modo],
      });
    } else {
      await db.execute({
        sql: `UPDATE configuracoes SET umidade_minima = ?, tempo_bomba = ?, modo = ? WHERE id = ?`,
        args: [umidadeMinima, tempoBomba, modo, existente.rows[0].id],
      });
    }

    res.json({ mensagem: 'Configuracoes atualizadas com sucesso.' });
  } catch (err) {
    console.error('Erro ao atualizar config:', err);
    res.status(500).json({ erro: 'Erro ao atualizar configuracoes.' });
  }
}

module.exports = { obterConfig, atualizarConfig };
