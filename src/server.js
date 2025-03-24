import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import {PORT, JWT_SECRET} from './config.js'
import tutorRoutes from './routes/tutorRoutes.js';
import {pool} from '../db.js'; // Importa el pool de conexiones
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';



dotenv.config();

const app = express();


// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Rutas
app.use('/api/tutor', tutorRoutes); // Monta las rutas de tutor en /api/tutor

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

app.post('/api/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    // Generar hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Guardar en la base de datos con la contraseña encriptada
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, NOW())',
      [name, email, hashedPassword, role]
    );

    res.json({ message: 'Usuario registrado exitosamente' });
  } catch (error) {
    console.error('Error en el registro:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {


    //encryptPasswords();
    
    // Buscar usuario en la base de datos usando el pool
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
   

    // Verificar si el usuario existe
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Usuario no encontrado.' });
    }

    const user = rows[0]; // Obtener el primer resultado

    // Verificar la contraseña
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Contraseña incorrecta.' });
    }

    // Generar token JWT 
    const token = jwt.sign({ id: user.id }, JWT_SECRET);

    // Enviar respuesta con el token
    res.json({ token, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    console.error('Error en el inicio de sesión:', error);
    res.status(500).json({ message: error });
  }
});


async function encryptPasswords() {
  try {
    // Obtener los usuarios con contraseñas en texto plano
    const [users] = await pool.query('SELECT id, password FROM users');

    for (let user of users) {
      if (!user.password.startsWith('$2a$')) { // Evita re-encriptar si ya están en bcrypt
        const hashedPassword = await bcrypt.hash(user.password, 10);

        // Actualizar la contraseña en la base de datos
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);

        console.log(`Contraseña del usuario ID ${user.id} encriptada.`);
      }
    }

    console.log('Todas las contraseñas han sido encriptadas.');
  } catch (error) {
    console.error('Error al encriptar contraseñas:', error);
  } finally {
    pool.end();
  }
}

