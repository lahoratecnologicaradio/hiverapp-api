import express from 'express';
import { Server } from 'socket.io';
import { pool } from '../db.js';
import dotenv from 'dotenv';
import { PORT } from './config.js';
import { createServer } from 'http';
import cors from 'cors';

// Configuración inicial
dotenv.config();
const app = express();

// Middlewares para HTTP
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] // Añadidos métodos PUT y DELETE
}));
app.use(express.json()); // Para parsear JSON en endpoints REST
app.use(express.static('public'));

// Creación del servidor HTTP
const httpServer = createServer(app);

// Configuración de Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'] // Añadidos métodos PUT y DELETE
  },
  transports: ['websocket', 'polling'] // Soporte para ambos transportes
});

// ================== ENDPOINTS HTTP ================== //

// Endpoint GET de ejemplo
app.get('/api/users', async (req, res) => {
  try {
    const [users] = await pool.query('SELECT * FROM users');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint POST de ejemplo
app.post('/api/users', async (req, res) => {
  try {
    const { name, email } = req.body;
    const [result] = await pool.query(
      'INSERT INTO users (name, email) VALUES (?, ?)',
      [name, email]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint PUT de ejemplo
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;
    await pool.query(
      'UPDATE users SET name = ?, email = ? WHERE id = ?',
      [name, email, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint DELETE de ejemplo
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para probar estado del servidor
app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    socketClients: io.engine.clientsCount,
    httpMethods: ['GET', 'POST', 'PUT', 'DELETE'] // Lista de métodos soportados
  });
});

// Endpoint para notificaciones de prueba
app.post('/test-notification', async (req, res) => {
  const { userId, message } = req.body;
  
  try {
    const [user] = await pool.query('SELECT socket_id FROM users WHERE id = ?', [userId]);
    if (user.length > 0 && user[0].socket_id) {
      io.to(user[0].socket_id).emit('test-message', { 
        message,
        timestamp: new Date().toISOString()
      });
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Usuario no encontrado o desconectado' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================== WEBSOCKETS ================== //

io.on('connection', (socket) => {
  console.log(`Nuevo cliente conectado: ${socket.id}`);

  // Autenticar usuario
  socket.on('autenticar', async (userId, callback) => {
    try {
      const [updateResult] = await pool.query(
        'UPDATE users SET online = true, socket_id = ? WHERE id = ?', 
        [socket.id, userId]
      );
      
      const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
      
      if (userRows.length === 0) {
        throw new Error('Usuario no encontrado');
      }
      
      const response = {
        success: true,
        user: userRows[0],
        updateResult: {
          affectedRows: updateResult.affectedRows,
          changedRows: updateResult.changedRows
        }
      };
      
      if (callback) callback(response);
    } catch (err) {
      //const errorResponse = { success: false, error: err.message };
          // Mensaje de error legible
    const mensajeError = `Error de autenticación: ${err.message}. Por favor, inténtalo de nuevo.`;
    if (callback) {
      callback({
        success: false,
        error: mensajeError,  // Texto legible
        detalles: err.message // Opcional: mantener el mensaje original
      });
    }
    }
  });

  // Manejo de llamadas
  socket.on('llamar', async ({ de, a }, callback) => {
    try {
      // 1. Registrar el intento de llamada en la BD
      const [callLog] = await pool.query(
        'INSERT INTO llamadas (origen_id, destino_id, estado) VALUES (?, ?, ?)',
        [de, a, 'iniciada']
      );
  
      // 2. Obtener información del destinatario
      const [results] = await pool.query(
        'SELECT socket_id, online FROM users WHERE id = ?', 
        [a]
      );
  
      const response = {
        callId: callLog.insertId,  // ID del registro creado
        destinatario: a,
        timestamp: new Date().toISOString()
      };
  
      if (results.length > 0) {
        const destinatario = results[0];
        response.destinatarioStatus = destinatario.online ? 'online' : 'offline';
  
        if (destinatario.socket_id && destinatario.online) {
          // 3. Actualizar estado en BD antes de notificar
          await pool.query(
            'UPDATE users SET ultima_llamada = NOW() WHERE id IN (?, ?)',
            [de, a]
          );
  
          // Notificar al destinatario
          io.to(destinatario.socket_id).emit('llamada_entrante', {
            de: de,
            socketId: socket.id,
            callId: callLog.insertId
          });
  
          response.status = 'notificado';
        } else {
          response.status = 'destinatario_no_disponible';
        }
      } else {
        response.status = 'destinatario_no_existe';
      }
  
      // 4. Verificación final (opcional - para debug)
      const [verify] = await pool.query(
        'SELECT * FROM llamadas WHERE id = ?',
        [callLog.insertId]
      );
      console.log('Registro de llamada verificado:', verify[0]);
  
      if (callback) callback(response);
  
    } catch (err) {
      console.error('Error en llamada:', err);
      
      // Registrar el error en la BD
      await pool.query(
        'INSERT INTO errores (endpoint, error, detalle) VALUES (?, ?, ?)',
        ['llamar', err.message, JSON.stringify({ de, a })]
      );
  
      if (callback) callback({
        success: false,
        error: err.message,
        dbUpdated: false
      });
    }
  });

  // Señales WebRTC
  socket.on('senal_webrtc', ({destinatario, señal}, callback) => {
    try {
      io.to(destinatario).emit('senal_webrtc', {
        remitente: socket.id,
        señal: señal,
        timestamp: Date.now()
      });
      if (callback) callback({ success: true });
    } catch (err) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // Manejo de desconexión
  socket.on('disconnect', async () => {
    console.log(`Cliente desconectado: ${socket.id}`);
    try {
      await pool.query(
        'UPDATE users SET online = false, socket_id = NULL WHERE socket_id = ?', 
        [socket.id]
      );
    } catch (err) {
      console.error('Error al actualizar estado:', err);
    }
  });
});

// Manejo de errores
io.engine.on("connection_error", (err) => {
  console.error("Error de conexión Socket.io:", err);
});

process.on('unhandledRejection', (err) => {
  console.error('Error no capturado:', err);
});

// Iniciar servidor
httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`- WebSockets: ws://localhost:${PORT}`);
  console.log(`- HTTP: http://localhost:${PORT}/api/users`);
  console.log(`- Estado: http://localhost:${PORT}/status`);
});