const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/auth');
const { verificarAdmin } = require('../middleware/admin');
const { obterResumo, limparBanco } = require('../controllers/adminController');

router.use(verificarToken, verificarAdmin);
router.get('/resumo', obterResumo);
router.post('/limpar', limparBanco);

module.exports = router;
