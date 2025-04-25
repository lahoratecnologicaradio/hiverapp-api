import mysql from 'mysql2';
import { pool } from '../../db.js';
import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import cloudinary from '../cloudinary.js';
import { Readable } from 'stream';

dotenv.config();

const app = express();
const upload = multer(); 

const StudentsController = {
  /**
   * Obtiene todos los estudiantes con información relacionada
   */
  getAllStudents: async (req, res) => {
    try {
      const [students] = await pool.query(`
        SELECT 
          s.*,
          c.name AS country_name
        FROM students s
        LEFT JOIN countries c ON s.country_id = c.id
        ORDER BY s.name ASC
      `);
      
      res.status(200).json({
        success: true,
        count: students.length,
        data: students
      });
    } catch (error) {
      console.error('Error obteniendo estudiantes:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estudiantes',
        error: error.message
      });
    }
  },

  /**
   * Obtiene un estudiante por ID con detalles completos
   */
  getStudentById: async (req, res) => {
    const { studentId } = req.params;

    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de estudiante no válido'
      });
    }

    try {
      // Consulta que incluye tutor y cursos del estudiante
      const [studentData] = await pool.query(`
        SELECT 
          s.*, 
          t.name AS tutor_name,
          t.email AS tutor_email
        FROM students s
        LEFT JOIN tutors t ON s.tutor_id = t.id
        WHERE s.id = ?
      `, [studentId]);

      if (studentData.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Estudiante no encontrado'
        });
      }

      const [courses] = await pool.query(`
        SELECT 
          c.id, 
          c.name, 
          c.description
        FROM courses c
        JOIN student_courses sc ON c.id = sc.course_id
        WHERE sc.student_id = ?
      `, [studentId]);

      const student = {
        ...studentData[0],
        courses
      };

      res.status(200).json({
        success: true,
        data: student
      });
    } catch (error) {
      console.error('Error obteniendo estudiante:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estudiante',
        error: error.message
      });
    }
  },

  /**
   * Obtiene estudiantes con filtros avanzados
   */
  getStudentsWithFilters: async (req, res) => {
    const { tutorId, courseId, status, name } = req.query;

    try {
      let query = `
        SELECT 
          s.*, 
          t.name AS tutor_name
        FROM students s
        LEFT JOIN tutors t ON s.tutor_id = t.id
        WHERE 1=1
      `;
      const params = [];

      if (tutorId) {
        query += ' AND s.tutor_id = ?';
        params.push(tutorId);
      }

      if (courseId) {
        query += ' AND s.id IN (SELECT student_id FROM student_courses WHERE course_id = ?)';
        params.push(courseId);
      }

      if (status) {
        query += ' AND s.status = ?';
        params.push(status);
      }

      if (name) {
        query += ' AND s.name LIKE ?';
        params.push(`%${name}%`);
      }

      query += ' ORDER BY s.name ASC';

      const [students] = await pool.query(query, params);

      res.status(200).json({
        success: true,
        count: students.length,
        data: students
      });
    } catch (error) {
      console.error('Error filtrando estudiantes:', error);
      res.status(500).json({
        success: false,
        message: 'Error al filtrar estudiantes',
        error: error.message
      });
    }
  },

  /**
   * Crea un nuevo estudiante
   */
  createStudent: async (req, res) => {
    const { name, email, tutor_id, status = 'active' } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Nombre y email son campos requeridos'
      });
    }

    try {
      const [result] = await pool.query(
        'INSERT INTO students (name, email, tutor_id, status) VALUES (?, ?, ?, ?)',
        [name, email, tutor_id, status]
      );

      const [newStudent] = await pool.query(
        'SELECT * FROM students WHERE id = ?',
        [result.insertId]
      );

      res.status(201).json({
        success: true,
        data: newStudent[0]
      });
    } catch (error) {
      console.error('Error creando estudiante:', error);
      
      let errorMessage = 'Error al crear estudiante';
      if (error.code === 'ER_DUP_ENTRY') {
        errorMessage = 'El email ya está registrado';
      }

      res.status(500).json({
        success: false,
        message: errorMessage,
        error: error.message
      });
    }
  },

  /**
   * Actualiza un estudiante existente
   */
  updateStudent: async (req, res) => {
    const { studentId } = req.params;
    const updateData = req.body;

    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de estudiante no válido'
      });
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionaron datos para actualizar'
      });
    }

    try {
      await pool.query(
        'UPDATE students SET ? WHERE id = ?',
        [updateData, studentId]
      );

      const [updatedStudent] = await pool.query(
        'SELECT * FROM students WHERE id = ?',
        [studentId]
      );

      if (updatedStudent.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Estudiante no encontrado'
        });
      }

      res.status(200).json({
        success: true,
        data: updatedStudent[0]
      });
    } catch (error) {
      console.error('Error actualizando estudiante:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar estudiante',
        error: error.message
      });
    }
  },

  /**
   * Elimina un estudiante
   */
  deleteStudent: async (req, res) => {
    const { studentId } = req.params;

    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de estudiante no válido'
      });
    }

    try {
      // Primero eliminamos las relaciones en student_courses
      await pool.query(
        'DELETE FROM student_courses WHERE student_id = ?',
        [studentId]
      );

      // Luego eliminamos el estudiante
      const [result] = await pool.query(
        'DELETE FROM students WHERE id = ?',
        [studentId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Estudiante no encontrado'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Estudiante eliminado correctamente'
      });
    } catch (error) {
      console.error('Error eliminando estudiante:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar estudiante',
        error: error.message
      });
    }
  }
};

export default StudentsController;