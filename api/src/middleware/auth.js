const jwt = require('jsonwebtoken');
const { db } = require('../database/database');

async function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token nao fornecido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const resultado = await db.execute({ sql: "SELECT id, role FROM usuarios WHERE id = ?", args: [payload.id] });
    if (!resultado.rows.length) return res.status(401).json({ erro: "Usuario inexistente." });
    req.usuario = { ...payload, role: resultado.rows[0].role };
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token invalido ou expirado.' });
  }
}

module.exports = { verificarToken };
