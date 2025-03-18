// db.js
import {createPool} from 'mysql2/promise';

// Configuración de la conexión a MySQL
export const pool = createPool({
  host: process.env.DB_HOST || 'localhost', // Dirección del servidor MySQL
  user: process.env.DB_USER || 'root',      // Usuario de MySQL
  password: process.env.DB_PASSWORD || '',  // Contraseña de MySQL
  database: process.env.DB_NAME || 'tutordb', // Nombre de la base de datos
});

