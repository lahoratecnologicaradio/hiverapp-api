import mysql from 'mysql2';
import {pool} from '../../db.js'; 
import Tutor from '../models/Tutor.js';







const getAllUsers = async (req, res) => {
  try {
    const [users] = await pool.query('SELECT * FROM usersVA');
    res.json(users); // Devuelve todos los usuarios en formato JSON
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};







export {  getAllUsers}; 
