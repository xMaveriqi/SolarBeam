const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/auth');
const {
	obterConfig,
	atualizarConfig,
	obterConfigDispositivo,
} = require('../controllers/configController');

router.get('/dispositivo', obterConfigDispositivo);
router.get('/', verificarToken, obterConfig);
router.post('/', verificarToken, atualizarConfig);

module.exports = router;
