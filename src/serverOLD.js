import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import {PORT, JWT_SECRET} from './config.js';
import tutorRoutes from './routes/tutorRoutes.js';
import {pool} from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import twilio from 'twilio';
import http from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Configuración de Socket.io
/*const io = new Server(server, {
  cors: {
    origin: "*", // Ajusta en producción
    methods: ["GET", "POST"],
    credentials: true
  }
});*/

const io = require('socket.io')(http);

// Almacén temporal de llamadas
const activeCalls = {};

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Rutas
app.use('/api/tutor', tutorRoutes);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});


// Socket.io Connection
io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  // Registrar usuario autenticado
  socket.on('register', async ({ userId, token }) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (decoded.id !== userId) {
        throw new Error('Token inválido');
      }

      socket.userId = userId;
      console.log(`Usuario ${userId} registrado para llamadas`);
      
      // Obtener datos del usuario desde DB
      const [user] = await pool.query('SELECT name FROM users WHERE id = ?', [userId]);
      socket.userName = user[0]?.name || 'Usuario';

    } catch (error) {
      console.error('Error en registro Socket.io:', error);
      socket.disconnect();
    }
  });

  // Iniciar llamada
  socket.on('start-call', async ({ callerId, calleeId }) => {
    try {
      // Verificar que ambos usuarios existen
      const [caller] = await pool.query('SELECT id, name FROM users WHERE id = ?', [callerId]);
      const [callee] = await pool.query('SELECT id FROM users WHERE id = ?', [calleeId]);

      if (!caller.length || !callee.length) {
        throw new Error('Usuario no encontrado');
      }

      activeCalls[callerId] = { 
        calleeId, 
        socketId: socket.id,
        callerName: caller[0].name
      };
      
      // Notificar al receptor
      io.to(calleeId).emit('incoming-call', { 
        callerId,
        callerName: caller[0].name
      });

    } catch (error) {
      console.error('Error al iniciar llamada:', error);
      socket.emit('call-error', { message: error.message });
    }
  });

  // Aceptar llamada
  socket.on('accept-call', ({ callerId, calleeId }) => {
    const call = activeCalls[callerId];
    if (!call) return;

    io.to(callerId).emit('call-accepted', { calleeId });
    io.to(calleeId).emit('call-started', { callerId });
  });

  // Transmitir señal WebRTC
  socket.on('webrtc-signal', ({ targetUserId, signal }) => {
    socket.to(targetUserId).emit('webrtc-signal', { 
      senderId: socket.userId, 
      signal 
    });
  });

  // Finalizar llamada
  socket.on('end-call', ({ callerId }) => {
    const call = activeCalls[callerId];
    if (!call) return;

    io.to(call.calleeId).emit('call-ended');
    delete activeCalls[callerId];
  });

  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
    // Limpiar llamadas si el usuario estaba en una
    Object.keys(activeCalls).forEach(callerId => {
      if (activeCalls[callerId].socketId === socket.id) {
        io.to(activeCalls[callerId].calleeId).emit('call-ended');
        delete activeCalls[callerId];
      }
    });
  }); 
});

// Endpoint para obtener datos de llamada
app.get('/api/call/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [user] = await pool.query(
      'SELECT id, name, image FROM users WHERE id = ?', 
      [userId]
    );

    if (!user.length) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      id: user[0].id,
      name: user[0].name,
      image: user[0].image
    });
  } catch (error) {
    console.error('Error obteniendo datos de usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});



app.post('/api/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    // Verificar si el usuario ya existe
    const [existingUser] = await pool.query(
      'SELECT * FROM users WHERE email = ?', 
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ 
        message: 'El correo electrónico ya está registrado' 
      });
    }

    // Generar hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Guardar en la base de datos
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, NOW())',
      [name, email, hashedPassword, role || 'user'] // Valor por defecto 'user' si no se especifica
    );

    // Respuesta compatible con el frontend
    res.status(201).json({ 
      success: true,
      message: 'Usuario registrado exitosamente',
      user: {
        id: result.insertId,
        name,
        email,
        role: role || 'user'
      }
    });
    
  } catch (error) {
    console.error('Error en el registro:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor',
      error: error.message // Opcional: enviar detalles del error
    });
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
    res.json({ token, name: user.name, email: user.email, role: user.role, id: user.id });
  } catch (error) {
    console.error('Error en el inicio de sesión:', error);
    res.status(500).json({ message: error });
  }
});

// Ruta para eliminar un usuario por ID
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params; // Obtener el ID del usuario de los parámetros de la URL

  try {
    // Verificar si el usuario existe
    const [user] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);

    if (user.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    // Eliminar el usuario de la base de datos
    await pool.query('DELETE FROM users WHERE id = ?', [id]);

    res.json({ message: 'Usuario eliminado exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar el usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});


app.post('/send-verification', async (req, res) => {
  const { phone } = req.body;
  const client = new twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  
  try {
    const verification = await client.verify.services('VAd34cbb7850296db01d7c4b6648f8a526')
      .verifications.create({ to: phone, channel: 'sms' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    //pool.end();
  }
}

