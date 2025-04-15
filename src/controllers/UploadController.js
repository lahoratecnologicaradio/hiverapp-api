import { Readable } from 'stream';
import cloudinary from '../cloudinary.js';
import { pool } from '../../db.js';

const UploadController = {
  uploadImage: async (req, res) => {
    try {
      // Verificar si hay un archivo en la solicitud
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
      }

      // Verificar si hay un userId en la solicitud
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'Se requiere un ID de usuario' });
      }

      // Subir la imagen a Cloudinary
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'usuarios' }, // Cambiado a carpeta de usuarios
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );

        Readable.from(req.file.buffer).pipe(stream);
      });

      // Guardar la URL en la tabla users
      const [updateResult] = await pool.query(
        'UPDATE users SET profile_image = ? WHERE id = ?',
        [result.secure_url, userId]
      );

      // Verificar si se actualizó algún registro
      if (updateResult.affectedRows === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      res.status(200).json({ 
        success: true,
        url: result.secure_url,
        message: 'Imagen de perfil actualizada correctamente'
      });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ 
        success: false,
        error: err.message || 'Error al subir la imagen y actualizar el perfil'
      });
    }
  },
};

export { UploadController };