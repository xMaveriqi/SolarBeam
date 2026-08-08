const express = require('express');
const router = express.Router();
const { criarUsuarioInicial } = require('../controllers/setupController');

router.post('/', criarUsuarioInicial);

module.exports = router;
