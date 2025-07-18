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
                apellidos,
                telefono,
                celular,
                direccion,
                cedula,
                email,
                provincia,
                municipio,
                sector,
                colegio_electoral,
                profesion_ocupacion,
                participacion_previas,
                participacion_cual,
                expectativas,
                rol_liderazgo,
                participar_comites,
                disponibilidad_viajar,
                nivel_academico = [],
                como_se_entero = [],
                habilidades = [],
                otro_nivel_academico,
                otro_como_se_entero,
                otra_habilidad,
                registrado_por,
                token_user_id,
                usersVA_id,
            } = req.body;
    
            // Combinar nombre y apellidos
            const nombreCompleto = `${nombre_completo} ${apellidos}`;
            let userId = usersVA_id;
    
            // 1. Verificar si el usuario existe en usersVA
            if (userId) {
                const checkUserQuery = `SELECT id FROM usersVA WHERE id = ?`;
                const [userRows] = await connection.query(checkUserQuery, [userId]);
                
                if (userRows.length === 0) {
                    userId = null; // Resetear el ID si no existe
                }
            }
    
            // Si no hay usersVA_id o el usuario no existe, crear uno nuevo
            if (!userId) {
                const insertUserQuery = `
                    INSERT INTO usersVA (
                        nombre, 
                        cedula, 
                        role, 
                        password, 
                        created_at, 
                        registrado_por, 
                        status
                    ) VALUES (?, ?, 'user', ?, NOW(), ?, 1)
                `;
                
                // Usar la cédula como contraseña inicial
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(cedula, salt);
                const [userResult] = await connection.query(insertUserQuery, [
                    nombreCompleto,
                    cedula,
                    hashedPassword, // password
                    registrado_por
                ]);
                
                userId = userResult.insertId;
                console.log('Nuevo usuario creado en usersVA con ID:', userId);
            } else {
                // 2. Actualizar el status en la tabla usersVA si ya existe
                const userQuery = `UPDATE usersVA SET status = 1 WHERE id = ?`;
                const [userResult] = await connection.query(userQuery, [userId]);
    
                // Verificar si se actualizó algún registro
                if (userResult.affectedRows === 0) {
                    throw new Error('No se pudo actualizar el usuario');
                }
            }
    
            // 3. Guardar en formulario_voz_activa
            const formQuery = `
                INSERT INTO formulario_voz_activa (
                    nombre_completo, telefono, celular, direccion, cedula, email, provincia,
                    municipio, sector, colegio_electoral, profesion_ocupacion,
                    participacion_previas, participacion_cual, expectativas, rol_liderazgo, 
                    participar_comites, disponibilidad_viajar, nivel_academico, como_se_entero, 
                    habilidades, otro_nivel_academico, otro_como_se_entero, otra_habilidad, 
                    fecha_registro, ip_registro, usersVA_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
    
            const formParams = [
                nombreCompleto, 
                telefono, 
                celular,
                direccion, 
                cedula, 
                email, 
                provincia,
                municipio, 
                sector, 
                colegio_electoral, 
                profesion_ocupacion,
                participacion_previas, 
                participacion_previas === 'Sí' ? participacion_cual : null,
                expectativas, 
                rol_liderazgo, 
                participar_comites,
                disponibilidad_viajar, 
                nivel_academico.length > 0 ? JSON.stringify(nivel_academico) : null,
                como_se_entero.length > 0 ? JSON.stringify(como_se_entero) : null,
                habilidades.length > 0 ? JSON.stringify(habilidades) : null,
                otro_nivel_academico,
                otro_como_se_entero, 
                otra_habilidad, 
                new Date(), 
                req.ip || '192',
                userId // Usar el ID del usuario (nuevo o existente)
            ];
    
            const [formResult] = await connection.query(formQuery, formParams);
    
            // Confirmar la transacción si todo salió bien
            await connection.commit();
    
            res.status(201).json({
                success: true,
                message: 'Formulario guardado y usuario actualizado exitosamente',
                formId: formResult.insertId,
                userId: userId,
                isNewUser: !usersVA_id // Indicar si se creó un nuevo usuario
            });
    
        } catch (error) {
            // Revertir la transacción en caso de error
            if (connection) await connection.rollback();
            
            console.error('Error al guardar los datos:', error);
            
            // Manejar errores específicos
            let errorMessage = 'Error al guardar los datos';
            if (error.code === 'ER_DUP_ENTRY') {
                if (error.message.includes('cedula')) {
                    errorMessage = 'La cédula ya tiene un formulario registrado';
                } else if (error.message.includes('usersVA.cedula')) {
                    errorMessage = 'La cédula ya está registrada en otro usuario';
                }
                return res.status(400).json({ success: false, message: errorMessage });
            }
            
            res.status(500).json({
                success: false,
                message: error.message || errorMessage,
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
          u.id AS user_id,
          u.nombre AS user_nombre,
          u.cedula AS user_cedula,
          u.role AS user_role,
          u.created_at AS user_created_at,
          u.status,
          u.registrado_por,
          (SELECT nombre FROM usersVA WHERE id = u.registrado_por) AS nombre_registrador,
          COUNT(DISTINCT f1.id) AS formularios_registrados,
          COUNT(DISTINCT f2.id) AS veces_registrado,
          (SELECT COUNT(*) FROM usersVA WHERE registrado_por = u.id) AS personas_registradas,
          (
              SELECT IFNULL(JSON_ARRAYAGG(
                  JSON_OBJECT(
                      'id', f.id,
                      'nombre_completo', f.nombre_completo,
                      'telefono', f.telefono,
                      'celular', f.celular,
                      'direccion', f.direccion,
                      'email', f.email,
                      'provincia', f.provincia,
                      'municipio', f.municipio,
                      'sector', f.sector,
                      'fecha_registro', f.fecha_registro,
                      'registrador_id', f.registrador_id,
                      'usersVA_id', f.usersVA_id
                  )
              ), JSON_ARRAY()) 
              FROM formulario_voz_activa f
              WHERE f.registrador_id = u.id
          ) AS formularios_como_registrador,
          (
              SELECT IFNULL(JSON_ARRAYAGG(
                  JSON_OBJECT(
                      'id', f.id,
                      'nombre_completo', f.nombre_completo,
                      'telefono', f.telefono,
                      'celular', f.celular,
                      'direccion', f.direccion,
                      'email', f.email,
                      'provincia', f.provincia,
                      'municipio', f.municipio,
                      'sector', f.sector,
                      'fecha_registro', f.fecha_registro,
                      'registrador_id', f.registrador_id,
                      'usersVA_id', f.usersVA_id,
                      'registrador_nombre', (SELECT nombre FROM usersVA WHERE id = f.registrador_id)
                  )
              ), JSON_ARRAY())
              FROM formulario_voz_activa f
              WHERE CAST(f.usersVA_id AS UNSIGNED) = u.id
          ) AS formularios_como_usuario
      FROM 
          usersVA u
      LEFT JOIN 
          formulario_voz_activa f1 ON f1.registrador_id = u.id
      LEFT JOIN 
          formulario_voz_activa f2 ON CAST(f2.usersVA_id AS UNSIGNED) = u.id
      GROUP BY 
          u.id, u.nombre, u.cedula, u.role, u.created_at, u.status, u.registrado_por
      ORDER BY 
          formularios_registrados DESC
      `);

      // Formatear los resultados sin parsear JSON (ya viene como objeto)
      const formattedResults = rows.map(row => ({
        id: row.user_id,
        nombre: row.user_nombre,
        cedula: row.user_cedula,
        role: row.user_role,
        created_at: row.user_created_at,
        status: row.status,
        registrado_por: row.registrado_por,
        nombre_registrador: row.nombre_registrador,
        formularios_registrados: row.formularios_registrados,
        personas_registradas: row.personas_registradas,
        veces_registrado: row.veces_registrado,
        formularios_como_registrador: row.formularios_como_registrador || [],
        formularios_como_usuario: row.formularios_como_usuario || []
      }));

      res.json(formattedResults);
    } catch (error) {
      console.error('Error obteniendo datos:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error interno del servidor al obtener los formularios',
        error: error.message 
      });
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
          // Obtener ambos parámetros de la query string
          const { status, registrado_por } = req.query;
          
          let query = 'SELECT * FROM usersVA';
          const conditions = [];
          const params = [];

          // Filtrar por status si está presente (0 o 1)
          if (status && (status === '0' || status === '1')) {
              conditions.push('status = ?');
              params.push(parseInt(status));
          }

          // Filtrar por registrado_por si está presente
          if (registrado_por) {
              conditions.push('registrado_por = ?');
              params.push(registrado_por);
          }

          // Combinar condiciones si existen
          if (conditions.length > 0) {
              query += ' WHERE ' + conditions.join(' AND ');
          }

          const [users] = await pool.query(query, params);

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


    
  cambiarPassword: async (req, res) => {
    let connection;
    try {
        // 1. Obtener datos del request
        const { usuarioId, passwordActual, nuevaPassword, confirmarPassword } = req.body;
        
        // 2. Validaciones básicas
        if (!usuarioId || !passwordActual || !nuevaPassword || !confirmarPassword) {
            return res.status(400).json({
                success: false,
                message: 'Todos los campos son requeridos'
            });
        }

        if (nuevaPassword !== confirmarPassword) {
            return res.status(400).json({
                success: false,
                message: 'Las nuevas contraseñas no coinciden'
            });
        }

        if (nuevaPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'La contraseña debe tener al menos 8 caracteres'
            });
        }

        // 3. Obtener conexión a la base de datos
        connection = await pool.getConnection();
        
        // 4. Verificar contraseña actual
        const [user] = await connection.query(
            'SELECT password FROM usersVA WHERE id = ?', 
            [usuarioId]
        );

        if (user.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const passwordValido = await bcrypt.compare(passwordActual, user[0].password);
        
        if (!passwordValido) {
            return res.status(401).json({
                success: false,
                message: 'Contraseña actual incorrecta'
            });
        }

        // 5. Hashear nueva contraseña
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(nuevaPassword, salt);

        // 6. Actualizar en base de datos
        await connection.query(
            'UPDATE usersVA SET password = ? WHERE id = ?',
            [passwordHash, usuarioId]
        );

        // 7. Opcional: Invalidar tokens JWT existentes si usas autenticación por tokens

        res.json({
            success: true,
            message: 'Contraseña cambiada exitosamente'
        });

    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar contraseña',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) connection.release();
    }
}
}


export  default UsersVAController; 
