const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/auth');
const { obterHistorico } = require('../controllers/historicoController');

router.get('/', verificarToken, obterHistorico);

module.exports = router;
