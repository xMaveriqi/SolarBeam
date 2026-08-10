const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/auth');
const { verificarAdmin } = require('../middleware/admin');
const { exportarBackup } = require('../controllers/backupController');

router.get('/', verificarToken, verificarAdmin, exportarBackup);

module.exports = router;