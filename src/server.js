import express from 'express';
import { Server } from 'socket.io';
import {pool} from '../db.js';
const app = express();




// Servir archivos estáticos
app.use(express.static('public'));

const server = app.listen(3000, () => {
  console.log('Servidor en puerto 3000');
});

const io = new Server(server);

// Manejo de conexiones Socket.io
io.on('connection', (socket) => {
  console.log(`Nuevo cliente conectado: ${socket.id}`);

  // Autenticar usuario y actualizar en BD
  socket.on('autenticar', async (userId) => {
    try {
      await pool.query('UPDATE usuarios SET online = true, socket_id = ? WHERE id = ?', 
        [socket.id, userId]);
      
      const [user] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [userId]);
      socket.emit('autenticado', user);
    } catch (err) {
      console.error(err);
    }
  });

  // Iniciar llamada a usuario específico
  socket.on('llamar', async ({de, a}) => {
    try {
      const [results] = await pool.query('SELECT socket_id FROM usuarios WHERE id = ?', [a]);
      
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
    pool.query('UPDATE usuarios SET online = false WHERE socket_id = ?', [socket.id]);
  });
});