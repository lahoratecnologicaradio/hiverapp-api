import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import multer from 'multer';
import  {getTutorDetails, getAllUsers, getAllTutors, getTutorById}  from '../controllers/tutorController.js';
import StudentsController from '../controllers/StudentsController.js';
import {UploadController} from '../controllers/UploadController.js';

const router = express.Router();
const upload = multer(); 



router.get('/', authMiddleware, getAllUsers);


router.get('/users', authMiddleware, getAllUsers);


router.post('/details/:tutorId', getTutorDetails);


router.get('/tutors', authMiddleware, getAllTutors);


router.get('/tutors/:tutorId', authMiddleware, getTutorById);


router.get('/students', StudentsController.getAllStudents);


router.get('/filtered', StudentsController.getStudentsWithFilters);

// Ruta para GET (obtener estudiante)
router.get('/students/:studentId', authMiddleware, StudentsController.getStudentById);

// Ruta para PATCH (actualizar estudiante)
router.patch('/students/:studentId', authMiddleware, StudentsController.updateStudent);


// 🚀 RUTA PARA SUBIR IMAGEN
router.post('/upload', upload.single('image'), UploadController.uploadImage);

export default router;
