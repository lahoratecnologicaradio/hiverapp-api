import express from 'express';
import { Server } from 'socket.io';
import {pool} from '../db.js';
import dotenv from 'dotenv';
import {PORT, JWT_SECRET} from './config.js';
const app = express();




// Servir archivos estáticos
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

const io = new Server(server);

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
      console.error(err);
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
      console.error(err);
    }
  });

  // Manejar señales WebRTC
  socket.on('senal_webrtc', ({destinatario, señal}) => {
    io.to(destinatario).emit('senal_webrtc', {
      remitente: socket.id,
      señal: señal
    });
  });

  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
    pool.query('UPDATE users SET online = false WHERE socket_id = ?', [socket.id]);
  });
});