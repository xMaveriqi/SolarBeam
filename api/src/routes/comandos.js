const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/auth');
const {
  criarComando,
  obterComandoPendente,
  marcarComandoExecutado,
} = require('../controllers/comandosController');

router.post('/', verificarToken, criarComando);
router.get('/', obterComandoPendente);
router.post('/:id/concluido', marcarComandoExecutado);

module.exports = router;
