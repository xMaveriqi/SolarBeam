const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/auth');
const { obterConfig, atualizarConfig } = require('../controllers/configController');

router.get('/', obterConfig);
router.post('/', verificarToken, atualizarConfig);

module.exports = router;
