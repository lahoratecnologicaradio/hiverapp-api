const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { getTutorDetails } = require('../controllers/tutorController');

// Ruta protegida para obtener detalles del tutor
router.get('/details', authMiddleware, getTutorDetails);

module.exports = router;
