import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import {PORT} from './config.js'
import router from './routes/tutorRoutes.js';

dotenv.config();

const app = express();


// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Rutas
app.use('/api/tutor', router);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  // Buscar usuario en la base de datos
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: 'Usuario no encontrado.' });
  }

  // Verificar contraseña
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: 'Contraseña incorrecta.' });
  }

  // Generar token JWT
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});
