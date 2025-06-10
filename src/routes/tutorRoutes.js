import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import multer from 'multer';
import  {getTutorDetails, getAllUsers, getAllTutors, getTutorById}  from '../controllers/tutorController.js';
import StudentsController from '../controllers/StudentsController.js';
import {UploadController} from '../controllers/UploadController.js';
import { getCallUserData } from '../controllers/callController.js';
import  UsersVAController  from '../controllers/UsersVAController.js';

const router = express.Router();
const upload = multer(); 



router.get('/', authMiddleware, getAllUsers);


router.get('/users', authMiddleware, getAllUsers);


router.post('/details/:tutorId', getTutorDetails);


router.get('/tutors', authMiddleware, getAllTutors);


router.get('/tutors/:tutorId', authMiddleware, getTutorById);


router.get('/students', StudentsController.getAllStudents);

// Rutas para guardar el formulario de VA

router.post('/userVA', UsersVAController.getUserByCedula);

// Ruta para guardar el formulario
router.post('/formularioVA', UsersVAController.saveFormData);

// Ruta get para obtener datos  del formulario
router.get('/formularioVA', UsersVAController.getForm);


router.get('/filtered', StudentsController.getStudentsWithFilters);

// Ruta para GET (obtener estudiante)
router.get('/students/:studentId', authMiddleware, StudentsController.getStudentById);

// Ruta para PATCH (actualizar estudiante)
router.patch('/students/:studentId', authMiddleware, StudentsController.updateStudent);

// Nueva ruta para datos de llamada
router.get('/call/user/:userId', authMiddleware, async (req, res) => {
    try {
      const user = await getCallUserData(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });


// 🚀 RUTA PARA SUBIR IMAGEN
router.post('/upload', upload.single('image'), UploadController.uploadImage);

export default router;
