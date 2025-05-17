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


// Endpoint de prueba directa
app.post('/api/test-db', async (req, res) => {
  try {
    const [result] = await pool.query('UPDATE users SET online = ? WHERE id = ?', 
      [req.body.online, req.body.id]);
    
    res.json({
      affectedRows: result.affectedRows,
      changedRows: result.changedRows
    });
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

app.get('/api/diagnostic/call/:callId', async (req, res) => {
  try {
    const [call] = await pool.query(
      `SELECT c.*, u1.name as caller_name, u2.name as receiver_name 
       FROM call_attempts c
       JOIN users u1 ON c.caller_id = u1.id
       JOIN users u2 ON c.receiver_id = u2.id
       WHERE c.id = ?`,
      [req.params.callId]
    );

    if (call.length === 0) {
      return res.status(404).json({ error: 'Llamada no encontrada' });
    }

    res.json({
      success: true,
      call: call[0],
      serverTime: new Date().toISOString(),
      activeConnections: io.engine.clientsCount
    });
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
    console.log(`[LLAMADA INICIADA] De: ${de}, A: ${a}, SocketID: ${socket.id}`);
    
    try {
      // 1. Verificar parámetros
      if (!de || !a) {
        throw new Error('Parámetros incompletos');
      }
  
      // 2. Registrar en la base de datos
      const [callLog] = await pool.query(
        'INSERT INTO call_attempts (caller_id, receiver_id, status) VALUES (?, ?, ?)',
        [de, a, 'attempted']
      );
      console.log('Registro de llamada creado:', callLog.insertId);
  
      // 3. Buscar destinatario
      const [results] = await pool.query(
        'SELECT id, socket_id, online FROM users WHERE id = ?',
        [a]
      );
      console.log('Resultados de búsqueda:', results);
  
      if (results.length === 0) {
        throw new Error('Destinatario no existe');
      }
  
      const destinatario = results[0];
      const response = {
        callId: callLog.insertId,
        receiver: destinatario.id,
        receiverOnline: destinatario.online,
        timestamp: new Date().toISOString()
      };
  
      if (destinatario.online && destinatario.socket_id) {
        // 4. Notificar al destinatario
        io.to(destinatario.socket_id).emit('llamada_entrante', {
          from: de,
          to: a,
          callId: callLog.insertId,
          socketId: socket.id
        });
        console.log(`Notificación enviada a: ${destinatario.socket_id}`);
        
        response.status = 'notified';
      } else {
        response.status = 'receiver_offline';
      }
  
      // 5. Actualizar base de datos
      await pool.query(
        'UPDATE call_attempts SET status = ? WHERE id = ?',
        [response.status, callLog.insertId]
      );
  
      // 6. Responder al llamante
      if (callback) {
        callback({
          success: true,
          ...response
        });
      }
  
    } catch (err) {
      console.error('[ERROR EN LLAMADA]', err);
      
      // Registrar error en base de datos
      await pool.query(
        'INSERT INTO error_logs (endpoint, error_message, details) VALUES (?, ?, ?)',
        ['socket/llamar', err.message, JSON.stringify({ de, a })]
      );
  
      if (callback) {
        callback({
          success: false,
          error: err.message,
          code: 'CALL_FAILED'
        });
      }
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