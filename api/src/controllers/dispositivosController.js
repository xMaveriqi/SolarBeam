const crypto = require('crypto');
const { db } = require('../database/database');
const { usuarioPodeAcessarDispositivo } = require('../middleware/deviceAccess');

function gerarCodigo() {

  return 'SB-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function fotoUrlValida(fotoUrl) {
  if (fotoUrl == null || fotoUrl === '') return true;

  if (typeof fotoUrl === 'string' && fotoUrl.startsWith('data:image/')) {
    const imagemValida = /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(fotoUrl);
    return imagemValida && fotoUrl.length <= 3500000;
  }

  try {
    return ['http:', 'https:'].includes(new URL(fotoUrl).protocol);
  } catch {
    return false;
  }
}

async function listarDispositivos(req, res) {
  try {
    const verTodos = req.query.todos === 'true' && req.usuario.role === 'admin';

    const resultado = verTodos
      ? await db.execute(`
          SELECT d.id, d.nome, d.codigo, d.criado_em, d.firmware_configurado, d.ultima_leitura, d.versao_firmware, d.localizacao, d.foto_url, u.email AS dono
          FROM dispositivos d
          JOIN usuarios u ON u.id = d.usuario_id
          ORDER BY d.id DESC
        `)
      : await db.execute({
          sql: `SELECT id, nome, codigo, criado_em, firmware_configurado, ultima_leitura, versao_firmware, localizacao, foto_url, token_dispositivo FROM dispositivos WHERE usuario_id = ? ORDER BY id DESC`,
          args: [req.usuario.id],
        });

    const agora = Date.now();
    const dispositivos = resultado.rows.map((dispositivo) => {
      const ultimaLeitura = dispositivo.ultima_leitura
        ? new Date(`${dispositivo.ultima_leitura}Z`).getTime()
        : 0;
      return {
        ...dispositivo,
        online: ultimaLeitura > 0 && agora - ultimaLeitura <= 120000,
      };
    });

    res.json(dispositivos);
  } catch (err) {
    console.error('Erro ao listar dispositivos:', err);
    res.status(500).json({ erro: 'Erro ao listar dispositivos.' });
  }
}

async function criarDispositivo(req, res) {
  const { nome, localizacao = null, fotoUrl = null } = req.body;

  if (!nome) {
    return res.status(400).json({ erro: 'Nome do dispositivo e obrigatorio.' });
  }
  if (!fotoUrlValida(fotoUrl)) {
    return res.status(400).json({ erro: 'A foto deve ser uma imagem válida ou uma URL http/https.' });
  }

  try {
    let codigo;
    const tokenDispositivo = crypto.randomBytes(32).toString('hex');
    let tentativas = 0;

    while (tentativas < 5) {
      codigo = gerarCodigo();
      const existe = await db.execute({
        sql: `SELECT id FROM dispositivos WHERE codigo = ?`,
        args: [codigo],
      });
      if (existe.rows.length === 0) break;
      tentativas++;
    }

    await db.execute({
      sql: `INSERT INTO dispositivos (nome, codigo, usuario_id, token_dispositivo, localizacao, foto_url) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [nome, codigo, req.usuario.id, tokenDispositivo, localizacao, fotoUrl],
    });

    res.status(201).json({
      mensagem: 'Dispositivo criado com sucesso.',
      codigo,
      tokenDispositivo,
      firmwareConfigurado: false,
      instrucao: 'Grave o firmware pelo navegador e envie o codigo do dispositivo para vincular as leituras.',
    });
  } catch (err) {
    console.error('Erro ao criar dispositivo:', err);
    res.status(500).json({ erro: 'Erro ao criar dispositivo.' });
  }
}

async function renomearDispositivo(req, res) {
  const { id } = req.params;
  const { nome, localizacao, fotoUrl } = req.body;

  if (!nome && localizacao === undefined && fotoUrl === undefined) {
    return res.status(400).json({ erro: 'Informe ao menos um campo para atualizar.' });
  }
  if (!fotoUrlValida(fotoUrl)) {
    return res.status(400).json({ erro: 'A foto deve ser uma imagem válida ou uma URL http/https.' });
  }

  try {
    const dispositivo = await db.execute({
      sql: `SELECT id, usuario_id FROM dispositivos WHERE id = ?`,
      args: [id],
    });

    if (dispositivo.rows.length === 0) {
      return res.status(404).json({ erro: 'Dispositivo nao encontrado.' });
    }

    const dono = dispositivo.rows[0].usuario_id;
    if (!usuarioPodeAcessarDispositivo(req.usuario, dono)) {
      return res.status(403).json({ erro: 'Voce nao tem permissao para editar esse dispositivo.' });
    }

    const campos = [];
    const args = [];
    if (nome !== undefined) { campos.push('nome = ?'); args.push(nome); }
    if (localizacao !== undefined) { campos.push('localizacao = ?'); args.push(localizacao || null); }
    if (fotoUrl !== undefined) { campos.push('foto_url = ?'); args.push(fotoUrl || null); }
    args.push(id);
    await db.execute({ sql: `UPDATE dispositivos SET ${campos.join(', ')} WHERE id = ?`, args });

    res.json({ mensagem: 'Dispositivo renomeado com sucesso.' });
  } catch (err) {
    console.error('Erro ao renomear dispositivo:', err);
    res.status(500).json({ erro: 'Erro ao renomear dispositivo.' });
  }
}

async function removerDispositivo(req, res) {
  const { id } = req.params;

  try {
    const dispositivo = await db.execute({
      sql: `SELECT id, usuario_id FROM dispositivos WHERE id = ?`,
      args: [id],
    });

    if (dispositivo.rows.length === 0) {
      return res.status(404).json({ erro: 'Dispositivo nao encontrado.' });
    }

    const dono = dispositivo.rows[0].usuario_id;
    if (!usuarioPodeAcessarDispositivo(req.usuario, dono)) {
      return res.status(403).json({ erro: 'Voce nao tem permissao para remover esse dispositivo.' });
    }

    await db.execute({
      sql: `DELETE FROM leituras WHERE dispositivo_id = ?`,
      args: [id],
    });

    await db.execute({
      sql: `DELETE FROM comandos WHERE dispositivo_id = ?`,
      args: [id],
    });

    await db.execute({
      sql: `DELETE FROM dispositivos WHERE id = ?`,
      args: [id],
    });

    res.json({ mensagem: 'Dispositivo removido com sucesso.' });
  } catch (err) {
    console.error('Erro ao remover dispositivo:', err);
    res.status(500).json({ erro: 'Erro ao remover dispositivo.' });
  }
}

module.exports = { listarDispositivos, criarDispositivo, renomearDispositivo, removerDispositivo };
