// db.js
const mysql = require('mysql2');

// Configuración de la conexión a MySQL
const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost', // Dirección del servidor MySQL
  user: process.env.DB_USER || 'root',      // Usuario de MySQL
  password: process.env.DB_PASSWORD || '',  // Contraseña de MySQL
  database: process.env.DB_NAME || 'tutordb', // Nombre de la base de datos
});

// Conectar a la base de datos
connection.connect((err) => {
  if (err) {
    console.error('Error conectando a MySQL:', err.stack);
    return;
  }
  console.log('Conectado a MySQL como id', connection.threadId);
});

module.exports = connection;
