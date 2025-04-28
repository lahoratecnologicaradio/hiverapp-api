import { pool } from '../../db.js';

export const getCallUserData = async (userId) => {
  try {
    const [user] = await pool.query(
      'SELECT id, name, image FROM users WHERE id = ?', 
      [userId]
    );
    return user[0] || null;
  } catch (error) {
    console.error('Error obteniendo datos de usuario:', error);
    throw error;
  }
};

export const verifyCallParticipants = async (callerId, calleeId) => {
  try {
    const [caller] = await pool.query('SELECT id FROM users WHERE id = ?', [callerId]);
    const [callee] = await pool.query('SELECT id FROM users WHERE id = ?', [calleeId]);
    
    return {
      callerExists: caller.length > 0,
      calleeExists: callee.length > 0
    };
  } catch (error) {
    console.error('Error verificando participantes:', error);
    throw error;
  }
};