import mysql from 'mysql2';
import {pool} from '../../db.js'; // Asegúrate de que db.js exporte la conexión a MySQL

export const getTutorDetails = async (req, res) => {
  const tutorId = req.params.tutorId; // Suponiendo que el ID del tutor viene en los parámetros de la URL

  try {
    // Obtener información del tutor
    const [tutor] = await pool.promise().query(
      'SELECT name, position FROM tutors WHERE id = ?',
      [tutorId]
    );

    if (!tutor.length) {
      return res.status(404).json({ message: 'Tutor no encontrado.' });
    }

    // Obtener cursos del tutor
    const [courses] = await pool.promise().query(
      'SELECT id, name FROM courses WHERE tutor_id = ?',
      [tutorId]
    );

    // Obtener estudiantes del tutor
    const [students] = await pool.promise().query(
      'SELECT id, name FROM students WHERE tutor_id = ?',
      [tutorId]
    );

    // Obtener reseñas del tutor
    const [reviews] = await pool.promise().query(
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

