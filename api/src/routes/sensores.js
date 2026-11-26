const express = require('express');
const router = express.Router();
const { receberLeitura } = require('../controllers/sensoresController');

router.post('/', receberLeitura);

module.exports = router;
