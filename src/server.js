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
const io = new Server(server, {
  cors: {
    origin: "*", // Ajusta en producción
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Almacén para conexiones activas
const activeUsers = new Map(); // { userId → socketId }

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Rutas
app.use('/api/tutor', tutorRoutes);

// WebSocket Connection
io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado:', socket.id);

  // Registrar usuario cuando inicie sesión
  socket.on('register-user', (userId) => {
    activeUsers.set(userId, socket.id);
    console.log(`Usuario ${userId} registrado con socket ${socket.id}`);
    
    // Actualizar en la base de datos
    pool.query('UPDATE users SET socket_id = ?, last_online = NOW() WHERE id = ?', [socket.id, userId])
      .catch(err => console.error('Error al actualizar socket_id:', err));
  });

  // Manejar llamadas entrantes
  socket.on('call-user', async ({ callerId, targetUserId, offer }) => {
    try {
      const [target] = await pool.query(
        'SELECT id, name, socket_id FROM users WHERE id = ?', 
        [targetUserId]
      );

      if (target.length === 0) {
        socket.emit('call-error', { message: 'Usuario no encontrado' });
        return;
      }

      const targetSocketId = target[0].socket_id;
      
      if (targetSocketId && io.sockets.sockets.has(targetSocketId)) {
        io.to(targetSocketId).emit('incoming-call', { 
          callerId,
          callerName: target[0].name,
          offer 
        });
      } else {
        socket.emit('call-error', { message: 'El usuario no está disponible' });
      }
    } catch (error) {
      console.error('Error en call-user:', error);
      socket.emit('call-error', { message: 'Error interno del servidor' });
    }
  });

  // Manejar respuestas a llamadas
  socket.on('answer-call', ({ to, answer }) => {
    io.to(to).emit('call-answered', { answer });
  });

  // Manejar ICE Candidates
  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { candidate });
  });

  // Limpieza al desconectar
  socket.on('disconnect', () => {
    activeUsers.forEach((value, key) => {
      if (value === socket.id) {
        activeUsers.delete(key);
        // Marcar como offline en la base de datos
        pool.query('UPDATE users SET socket_id = NULL WHERE id = ?', [key])
          .catch(err => console.error('Error al actualizar estado:', err));
      }
    });
    console.log('Cliente desconectado:', socket.id);
  });
});

// Endpoints REST
app.get('/api/call/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [user] = await pool.query(
      'SELECT id, name, image, socket_id, last_online FROM users WHERE id = ?', 
      [userId]
    );

    if (!user.length) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const isOnline = user[0].socket_id && 
                    io.sockets.sockets.has(user[0].socket_id);

    res.json({
      id: user[0].id,
      name: user[0].name,
      image: user[0].image,
      isOnline,
      lastOnline: user[0].last_online
    });
  } catch (error) {
    console.error('Error obteniendo datos de usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const [existingUser] = await pool.query(
      'SELECT * FROM users WHERE email = ?', 
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ 
        message: 'El correo electrónico ya está registrado' 
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, NOW())',
      [name, email, hashedPassword, role || 'user']
    );

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
      error: error.message
    });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
   
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Usuario no encontrado.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);  

    if (!isMatch) {
      return res.status(400).json({ message: 'Contraseña incorrecta.' });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET);

    res.json({ 
      token, 
      name: user.name, 
      email: user.email, 
      role: user.role, 
      id: user.id 
    });
  } catch (error) {
    console.error('Error en el inicio de sesión:', error);
    res.status(500).json({ message: error });
  }
});


app.post('/api/registerVA', async (req, res) => {
  const { nombre, cedula, role, token_registrado, registrado_por, status } = req.body;

  try {
    const [existingUser] = await pool.query(
      'SELECT * FROM usersVA WHERE cedula = ?', 
      [cedula]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ 
        message: 'La cédula ya está registrada' 
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(cedula, salt);

    // Determinar el valor de status (si viene en el body lo usamos, sino 0)
    const statusValue = status !== undefined ? status : 0;

    const [result] = await pool.query(
      'INSERT INTO usersVA (nombre, cedula, password, role, token_registrado, registrado_por, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [nombre, cedula, hashedPassword, role || 'user', token_registrado, registrado_por, statusValue]
    );
    

    res.status(201).json({ 
      success: true,
      message: 'Usuario registrado exitosamente',
      user: {
        id: result.insertId,
        nombre,
        cedula,
        role: role || 'user',
        token_registrado,
        registrado_por,
        status: statusValue
      }
    });
    
  } catch (error) {
    console.error('Error en el registro:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

app.post('/api/loginVA', async (req, res) => {
  const { cedula, password } = req.body;

  try {
    const [rows] = await pool.query('SELECT * FROM usersVA WHERE cedula = ?', [cedula]);
   
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Usuario no encontrado.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);  

    if (!isMatch) {
      return res.status(400).json({ message: 'Contraseña incorrecta.' });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET);

    res.json({ 
      token, 
      name: user.nombre, 
      cedula: user.cedula,
      celular:  user.celular,
      role: user.role, 
      id: user.id,
      token_registrado: user.token_registrado,
      registrado_por:user.registrado_por,
      status: user.status
    });
  } catch (error) {
    console.error('Error en el inicio de sesión:', error);
    res.status(500).json({ message: error });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [user] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);

    if (user.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

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

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});