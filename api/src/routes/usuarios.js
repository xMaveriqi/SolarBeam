const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/auth');
const { verificarAdmin } = require('../middleware/admin');
const { listarUsuarios, criarUsuario, removerUsuario } = require('../controllers/usuariosController');

router.get('/', verificarToken, verificarAdmin, listarUsuarios);
router.post('/', verificarToken, verificarAdmin, criarUsuario);
router.delete('/:id', verificarToken, verificarAdmin, removerUsuario);

module.exports = router;
