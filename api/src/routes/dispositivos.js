const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/auth');
const {
  listarDispositivos,
  criarDispositivo,
  renomearDispositivo,
  removerDispositivo,
} = require('../controllers/dispositivosController');

router.get('/', verificarToken, listarDispositivos);
router.post('/', verificarToken, criarDispositivo);
router.patch('/:id', verificarToken, renomearDispositivo);
router.delete('/:id', verificarToken, removerDispositivo);

module.exports = router;
