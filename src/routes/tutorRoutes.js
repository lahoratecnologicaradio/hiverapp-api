import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import  {getTutorDetails, getAllUsers, getAllTutors, getTutorById}  from '../controllers/tutorController.js';

const router = express.Router();



router.get('/', authMiddleware, getAllUsers);


router.get('/users', authMiddleware, getAllUsers);


router.post('/details/:tutorId', getTutorDetails);


router.get('/tutors', authMiddleware, getAllTutors);


router.get('/tutors/:tutorId', authMiddleware, getTutorById);


export default router;
