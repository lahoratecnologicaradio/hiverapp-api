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
  socket.on('autenticar', async (userId) => {
    try {
      await pool.query('UPDATE users SET online = true, socket_id = ? WHERE id = ?', 
        [socket.id, userId]);
      
      const [user] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
      socket.emit('autenticado', user);
    } catch (err) {
      console.error('Error en autenticación:', err);
    }
  });

  // Iniciar llamada a usuario específico
  socket.on('llamar', async ({de, a}) => {
    try {
      const [results] = await pool.query('SELECT socket_id FROM users WHERE id = ?', [a]);
      
      if (results.length > 0 && results[0].socket_id) {
        const destinatarioSocketId = results[0].socket_id;
        
        // Notificar al destinatario
        io.to(destinatarioSocketId).emit('llamada_entrante', {
          de: de,
          socketId: socket.id
        });
      }
    } catch (err) {
      console.error('Error en llamada:', err);
    }
  });

  // Manejar señales WebRTC
  socket.on('senal_webrtc', ({destinatario, señal}) => {
    io.to(destinatario).emit('senal_webrtc', {
      remitente: socket.id,
      señal: señal
    });
  });

  // Manejar desconexión
  socket.on('disconnect', async () => {
    console.log(`Cliente desconectado: ${socket.id}`);
    try {
      await pool.query('UPDATE users SET online = false, socket_id = NULL WHERE socket_id = ?', [socket.id]);
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





