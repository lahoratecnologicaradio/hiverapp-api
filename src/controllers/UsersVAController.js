import mysql from 'mysql2';
import {pool} from '../../db.js'; 
import Tutor from '../models/Tutor.js';
import bcrypt from 'bcryptjs';




const UsersVAController = {

saveFormData: async (req, res) => {
    let connection;
    try {
      // Obtener conexión del pool para transacción
      connection = await pool.getConnection();
      await connection.beginTransaction();
  
      // Obtener datos del cuerpo de la solicitud
      const {
        nombre_completo,
        telefono,
        direccion,
        cedula,
        email,
        provincia,
        municipio,
        sector,
        colegio_electoral,
        profesion_ocupacion,
        participacion_previas,
        expectativas,
        rol_liderazgo,
        participar_comites,
        disponibilidad_viajar,
        nivel_academico,
        como_se_entero,
        habilidades,
        otro_nivel_academico,
        otro_como_se_entero,
        otra_habilidad,
        registrador_id
      } = req.body;
  
      // 1. Primero guardar en la tabla usersVA
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(cedula, salt);

      const userQuery = `
        INSERT INTO usersVA (
          nombre, cedula, password, role, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `;
      
      const userParams = [
        nombre_completo,
        cedula, // Usamos la cédula como password
        hashedPassword,
        'user', // Rol fijo 'user'
        new Date() // Fecha actual
      ];
  
      const [userResult] = await connection.query(userQuery, userParams);
  
      // 2. Luego guardar en formulario_voz_activa
      const formQuery = `
      INSERT INTO formulario_voz_activa (
        nombre_completo, telefono, direccion, cedula, email, provincia,
        municipio, sector, colegio_electoral, profesion_ocupacion,
        participacion_previas, expectativas, rol_liderazgo, participar_comites,
        disponibilidad_viajar, nivel_academico, como_se_entero, habilidades,
        otro_nivel_academico, otro_como_se_entero, otra_habilidad, fecha_registro, registrador_id, ip_registro
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
  
      const formParams = [
        nombre_completo, telefono, direccion, cedula, email, provincia,
        municipio, sector, colegio_electoral, profesion_ocupacion,
        participacion_previas, expectativas, rol_liderazgo, participar_comites,
        disponibilidad_viajar, 
        JSON.stringify(nivel_academico), 
        JSON.stringify(como_se_entero), 
        JSON.stringify(habilidades),
        otro_nivel_academico, otro_como_se_entero, otra_habilidad,  new Date() , registrador_id, '192'
      ];
  
      const [formResult] = await connection.query(formQuery, formParams);
  
      // Confirmar la transacción si todo salió bien
      await connection.commit();
  
      res.status(201).json({
        success: true,
        message: 'Datos guardados exitosamente en ambas tablas',
        userId: userResult.insertId,
        formId: formResult.insertId
      });
  
    } catch (error) {
      // Revertir la transacción en caso de error
      if (connection) await connection.rollback();
      
      console.error('Error al guardar los datos:', error);
      
      // Manejar errores específicos
      let errorMessage = 'Error al guardar los datos';
      if (error.code === 'ER_DUP_ENTRY') {
        if (error.message.includes('usersVA.cedula')) {
          errorMessage = 'La cédula ya está registrada como usuario';
        } else {
          errorMessage = 'La cédula ya tiene un formulario registrado';
        }
        return res.status(400).json({ success: false, message: errorMessage });
      }
      
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: error.message
      });
    } finally {
      // Liberar la conexión
      if (connection) connection.release();
    }
  },

  getUserByCedula: async (req, res) => {
    try {
      const { cedula } = req.body;
  
      if (!cedula) {
        return res.status(400).json({ message: 'La cédula es requerida.' });
      }
  
      const [users] = await pool.query('SELECT * FROM usersVA WHERE cedula = ?', [cedula]);
  
      if (users.length === 0) {
        return res.status(404).json({ message: 'Usuario no encontrado.' });
      }
  
      res.json(users[0]); // Devuelve el primer usuario encontrado
    } catch (error) {
      console.error('Error obteniendo usuario por cédula:', error);
      res.status(500).json({ message: 'Error interno del servidor.' });
    }
  },
  

  getForm: async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT 
          f.*, 
          COALESCE(r.cantidad, 0) AS personas_registradas
        FROM formulario_voz_activa AS f
        LEFT JOIN (
          SELECT 
            u.cedula AS cedula_registrador,
            COUNT(f2.id) AS cantidad
          FROM usersVA u
          LEFT JOIN formulario_voz_activa f2 
            ON f2.registrador_id = u.id
          GROUP BY u.cedula
        ) AS r
          ON f.cedula COLLATE utf8mb4_unicode_ci = r.cedula_registrador COLLATE utf8mb4_unicode_ci
      `);
  
      res.json(rows);
    } catch (error) {
      console.error('Error obteniendo datos:', error);
      res.status(500).json({ message: 'Error interno del servidor.' });
    }
  },

  getReclutadorByToken: async (req, res) => {
    let connection;
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ 
                success: false,
                message: 'El token es requerido' 
            });
        }

        connection = await pool.getConnection();

        // Buscar el usuario por el token_registrado
        const [users] = await connection.query(
            'SELECT id, nombre, cedula, registrado_por FROM usersVA WHERE token_registrado = ?',
            [token]
        );

        if (users.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'No se encontró ningún reclutador con ese token' 
            });
        }

        const user = users[0];

        res.json({
            success: true,
            data: {
                id: user.id,
                nombre: user.nombre,
                cedula: user.cedula,
                registrado_por: user.registrado_por
            }
        });

    } catch (error) {
        console.error('Error al buscar reclutador por token:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error interno del servidor',
            error: error.message 
        });
    } finally {
        if (connection) connection.release();
    }
},

  getUsers: async (req, res) => {
    try {
      // Consulta los usuarios cuyo estatus sea 1
      const [users] = await pool.query('SELECT * FROM usersVA WHERE status = ?', [1]);

      res.status(200).json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  },

    
  cambiarPassword:async (req, res) => {
  }
}


export  default UsersVAController; 
