import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import  {getTutorDetails, getAllUsers}  from '../controllers/tutorController.js';

const router = express.Router();


// Nueva ruta para obtener todos los usuarios
router.get('/', authMiddleware, getAllUsers);

// Ruta protegida para obtener detalles del tutor
router.get('/details', authMiddleware, getTutorDetails);
7
// Ruta para obtener detalles del tutor
router.get('/:tutorId', getTutorDetails);

export default router;
