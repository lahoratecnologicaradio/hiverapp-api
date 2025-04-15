import { Readable } from 'stream';
import cloudinary from '../config/cloudinary.js'; 

const UploadController = {
  uploadImage: async (req, res) => {
    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'mis_imagenes' },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );

        Readable.from(req.file.buffer).pipe(stream);
      });

      res.status(200).json({ url: result.secure_url });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ error: 'Error al subir la imagen' });
    }
  },
};

export {UploadController} 