import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import  {getTutorDetails, getAllUsers}  from '../controllers/tutorController.js';

const router = express.Router();


// Nueva ruta para obtener todos los usuarios
router.get('/', authMiddleware, getAllUsers);

// Ruta protegida para obtener detalles del tutor
router.get('/users', authMiddleware, getAllUsers);

// Ruta para obtener detalles del tutor
router.post('/details/:tutorId', getTutorDetails);

export default router;
