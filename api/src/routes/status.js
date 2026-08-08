const express = require('express');
const router = express.Router();
const { obterStatus } = require('../controllers/statusController');

router.get('/', obterStatus);

module.exports = router;
