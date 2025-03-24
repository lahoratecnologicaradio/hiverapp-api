import mysql from 'mysql2';
import {pool} from '../../db.js'; // Asegúrate de que db.js exporte la conexión a MySQL

const getTutorDetails = async (req, res) => {
  // Suponiendo que el tutorId se recibe en el cuerpo de la solicitud (POST)
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


// Controlador para obtener todos los usuarios
const getAllUsers = async (req, res) => {
  try {
    const [users] = await pool.query('SELECT * FROM users');
    res.json(users); // Devuelve todos los usuarios en formato JSON
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export { getTutorDetails, getAllUsers }; // Exporta ambos controladores

