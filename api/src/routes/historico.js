const express = require('express');
const router = express.Router();
const { obterHistorico } = require('../controllers/historicoController');

router.get('/', obterHistorico);

module.exports = router;
