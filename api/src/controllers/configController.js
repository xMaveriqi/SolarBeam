const { db } = require('../database/database');
const crypto = require('crypto');

function tokenValido(esperado, recebido) {
  if (!esperado || !recebido) return false;
  const esperadoBuffer = Buffer.from(esperado);
  const recebidoBuffer = Buffer.from(recebido);
  return esperadoBuffer.length === recebidoBuffer.length &&
    crypto.timingSafeEqual(esperadoBuffer, recebidoBuffer);
}

async function obterConfig(req, res) {
  try {
    let resultado = await db.execute(
      `SELECT id, umidade_minima, tempo_bomba, modo, versao FROM configuracoes ORDER BY id DESC LIMIT 1`
    );

    if (resultado.rows.length === 0) {
      await db.execute(
        `INSERT INTO configuracoes (umidade_minima, tempo_bomba, modo) VALUES (30, 10, 'automatico')`
      );
      resultado = await db.execute(
        `SELECT id, umidade_minima, tempo_bomba, modo, versao FROM configuracoes ORDER BY id DESC LIMIT 1`
      );
    }

    const config = resultado.rows[0];
    res.json({
      umidadeMinima: config.umidade_minima,
      tempoBomba: config.tempo_bomba,
      modo: config.modo,
      versao: config.versao,
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
        sql: `INSERT INTO configuracoes (umidade_minima, tempo_bomba, modo, versao) VALUES (?, ?, ?, 1)`,
        args: [umidadeMinima, tempoBomba, modo],
      });
    } else {
      await db.execute({
        sql: `UPDATE configuracoes SET umidade_minima = ?, tempo_bomba = ?, modo = ?, versao = versao + 1 WHERE id = ?`,
        args: [umidadeMinima, tempoBomba, modo, existente.rows[0].id],
      });
    }

    res.json({ mensagem: 'Configuracoes atualizadas com sucesso.' });
  } catch (err) {
    console.error('Erro ao atualizar config:', err);
    res.status(500).json({ erro: 'Erro ao atualizar configuracoes.' });
  }
}

async function obterConfigDispositivo(req, res) {
  const { codigo, tokenDispositivo } = req.query;

  if (!codigo || !tokenDispositivo) {
    return res.status(400).json({ erro: 'Codigo e token do dispositivo obrigatorios.' });
  }

  try {
    const dispositivo = await db.execute({
      sql: `SELECT token_dispositivo FROM dispositivos WHERE codigo = ?`,
      args: [codigo],
    });

    if (dispositivo.rows.length === 0) {
      return res.status(404).json({ erro: 'Codigo de dispositivo nao reconhecido.' });
    }

    if (!tokenValido(dispositivo.rows[0].token_dispositivo, tokenDispositivo)) {
      return res.status(401).json({ erro: 'Token do dispositivo invalido.' });
    }

    const resultado = await db.execute(
      `SELECT umidade_minima, tempo_bomba, modo, versao FROM configuracoes ORDER BY id DESC LIMIT 1`
    );
    const config = resultado.rows[0] || {
      umidade_minima: 30,
      tempo_bomba: 10,
      modo: 'automatico',
      versao: 0,
    };

    res.json({
      umidadeMinima: config.umidade_minima,
      tempoBomba: config.tempo_bomba,
      modo: config.modo,
      versao: config.versao,
    });
  } catch (err) {
    console.error('Erro ao buscar config do dispositivo:', err);
    res.status(500).json({ erro: 'Erro ao buscar configuracoes.' });
  }
}

module.exports = { obterConfig, atualizarConfig, obterConfigDispositivo };
