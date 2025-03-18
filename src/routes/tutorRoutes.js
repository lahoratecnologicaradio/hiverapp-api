import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import  {getTutorDetails}  from '../controllers/tutorController.js';

const router = express.Router();

// Ruta protegida para obtener detalles del tutor
router.get('/details', authMiddleware, getTutorDetails);

// Ruta para obtener detalles del tutor
router.get('/:tutorId', getTutorDetails);

export default router;
