const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/auth');
const { obterStatus } = require('../controllers/statusController');

router.get('/', verificarToken, obterStatus);

module.exports = router;
