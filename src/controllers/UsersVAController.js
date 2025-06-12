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
        SELECT  f.*,
                COALESCE(c.personas_registradas, 0) AS personas_registradas
        FROM    formulario_voz_activa AS f
        LEFT JOIN (
            SELECT  registrador_id,
                    COUNT(*) AS personas_registradas
            FROM    formulario_voz_activa
            WHERE   registrador_id IS NOT NULL
            GROUP BY registrador_id
        ) AS c  ON f.id = c.registrador_id
        ORDER BY f.id;
      `);
  
      res.json(rows);
    } catch (error) {
      console.error('Error obteniendo formularios:', error);
      res.status(500).json({ message: 'Error interno del servidor.' });
    }
  };
  

 // cambiarPassword:

}


export  default UsersVAController; 
