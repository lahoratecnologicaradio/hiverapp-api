import mysql from 'mysql2';
import {pool} from '../../db.js'; 
import Tutor from '../models/Tutor.js';



const getTutorDetails = async (req, res) => {
  const { tutorId } = req.body;

  if (!tutorId) {
    return res.status(400).json({ message: 'El ID del tutor es necesario.' });
  }

  try {
    // Obtener información del tutor
    const [tutor] = await pool.query(
      'SELECT name, position FROM tutors WHERE id = ?',
      [tutorId]
    );

    if (!tutor.length) {
      return res.status(404).json({ message: 'Tutor no encontrado.' });
    }

    // Obtener cursos del tutor
    const [courses] = await pool.query(
      'SELECT id, name FROM courses WHERE tutor_id = ?',
      [tutorId]
    );

    // Obtener estudiantes del tutor
    const [students] = await pool.query(
      'SELECT id, name FROM students WHERE tutor_id = ?',
      [tutorId]
    );

    // Obtener reseñas del tutor
    const [reviews] = await pool.query(
      'SELECT id, comment FROM reviews WHERE tutor_id = ?',
      [tutorId]
    );

    // Construir el objeto de respuesta
    const tutorInfo = {
      name: tutor[0].name,
      position: tutor[0].position,
      courses,
      students,
      reviews,
    };

    res.json(tutorInfo);
  } catch (error) {
    console.error('Error obteniendo detalles del tutor:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};



const getAllUsers = async (req, res) => {
  try {
    const [users] = await pool.query('SELECT * FROM users');
    res.json(users); // Devuelve todos los usuarios en formato JSON
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};



const getAllTutors = async (req, res) => {
    try {
        const tutors = await Tutor.find(); // Obtiene todos los tutores de la BD
        res.status(200).json({ success: true, data: tutors });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener los tutores', error });
    }
};


const getTutorById = async (req, res) => {
    try {
        const { tutorId } = req.params; // Obtiene el ID desde la URL
        const tutor = await Tutor.findById(tutorId); // Busca el tutor en la BD

        if (!tutor) {
            return res.status(404).json({ success: false, message: 'Tutor no encontrado' });
        }

        res.status(200).json({ success: true, data: tutor });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener el tutor', error });
    }
};



export { getTutorDetails, getAllUsers, getAllTutors, getTutorById }; 

