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

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));
app.use(express.static('public'));

// Creación del servidor HTTP
const httpServer = createServer(app);

// Configuración de Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Manejo de conexiones Socket.io
io.on('connection', (socket) => {
  console.log(`Nuevo cliente conectado: ${socket.id}`);

  // Autenticar usuario y actualizar en BD
  socket.on('autenticar', async (userId, callback) => {
    try {
      // Actualizar estado del usuario
      const updateResult = await pool.query(
        'UPDATE users SET online = true, socket_id = ? WHERE id = ?', 
        [socket.id, userId]
      );
      
      // Obtener datos actualizados del usuario
      const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
      
      if (userRows.length === 0) {
        throw new Error('Usuario no encontrado después de actualizar');
      }
      
      const user = userRows[0];
      
      // Emitir respuesta con todos los datos relevantes
      const response = {
        success: true,
        user: user,
        updateResult: {
          affectedRows: updateResult[0].affectedRows,
          changedRows: updateResult[0].changedRows
        }
      };
      
      socket.emit('autenticado', response);
      if (callback) callback(response);

    } catch (err) {
      console.error('Error en autenticación:', err);
      const errorResponse = {
        success: false,
        error: err.message
      };
      socket.emit('error_autenticacion', errorResponse);
      if (callback) callback(errorResponse);
    }
  });

  // Iniciar llamada a usuario específico
  socket.on('llamar', async ({de, a}, callback) => {
    try {
      const [results] = await pool.query('SELECT socket_id, online FROM users WHERE id = ?', [a]);
      
      const response = {
        queryResults: results,
        destinatarioId: a,
        callerId: de
      };
      
      if (results.length > 0) {
        const destinatario = results[0];
        response.destinatarioData = destinatario;
        
        if (destinatario.socket_id && destinatario.online) {
          response.status = 'destinatario_encontrado';
          const destinatarioSocketId = destinatario.socket_id;
          
          // Notificar al destinatario
          io.to(destinatarioSocketId).emit('llamada_entrante', {
            de: de,
            socketId: socket.id
          });
          
          response.message = 'Llamada enviada correctamente';
        } else {
          response.status = 'destinatario_no_disponible';
          response.message = 'El destinatario no está conectado';
        }
      } else {
        response.status = 'destinatario_no_existe';
        response.message = 'El destinatario no existe';
      }
      
      socket.emit('estado_llamada', response);
      if (callback) callback(response);

    } catch (err) {
      console.error('Error en llamada:', err);
      const errorResponse = {
        success: false,
        error: err.message
      };
      socket.emit('error_llamada', errorResponse);
      if (callback) callback(errorResponse);
    }
  });

  // Manejar señales WebRTC
  socket.on('senal_webrtc', ({destinatario, señal}, callback) => {
    try {
      io.to(destinatario).emit('senal_webrtc', {
        remitente: socket.id,
        señal: señal
      });
      
      if (callback) callback({ success: true, message: 'Señal enviada' });
    } catch (err) {
      console.error('Error enviando señal:', err);
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // Manejar desconexión
  socket.on('disconnect', async () => {
    console.log(`Cliente desconectado: ${socket.id}`);
    try {
      const result = await pool.query(
        'UPDATE users SET online = false, socket_id = NULL WHERE socket_id = ?', 
        [socket.id]
      );
      console.log('Resultado de desconexión:', result[0]);
    } catch (err) {
      console.error('Error al actualizar estado:', err);
    }
  });
});

// Manejo de errores de conexión
io.engine.on("connection_error", (err) => {
  console.log("Error de conexión Socket.io:");
  console.log(err.req);
  console.log(err.code);
  console.log(err.message);
  console.log(err.context);
});

// Iniciar servidor
httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('Error no capturado:', err);
});