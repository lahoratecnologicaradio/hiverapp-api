import { pool } from '../../db.js';

class Tutor {
  constructor({ id, name, email, position, specialization, created_at, updated_at }) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.position = position;
    this.specialization = specialization;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  /**
   * Crea un nuevo tutor en la base de datos
   * @param {Object} tutorData - Datos del tutor {name, email, position, specialization}
   * @returns {Promise<Tutor>} - Instancia del tutor creado
   */
  static async create(tutorData) {
    const [result] = await pool.query(
      'INSERT INTO tutors SET ?',
      [tutorData]
    );
    return await Tutor.findById(result.insertId);
  }

  /**
   * Obtiene todos los tutores de la base de datos
   * @returns {Promise<Array<Tutor>>} - Lista de tutores
   */
  static async findAll() {
    const [tutors] = await pool.query(`
      SELECT * FROM tutors ORDER BY name ASC
    `);
    return tutors.map(tutor => new Tutor(tutor));
  }

  /**
   * Busca un tutor por su ID
   * @param {number} id - ID del tutor
   * @returns {Promise<Tutor|null>} - Tutor encontrado o null
   */
  static async findById(id) {
    const [tutors] = await pool.query(
      'SELECT * FROM tutors WHERE id = ?',
      [id]
    );
    return tutors[0] ? new Tutor(tutors[0]) : null;
  }

  /**
   * Busca un tutor por email
   * @param {string} email - Email del tutor
   * @returns {Promise<Tutor|null>} - Tutor encontrado o null
   */
  static async findByEmail(email) {
    const [tutors] = await pool.query(
      'SELECT * FROM tutors WHERE email = ?',
      [email]
    );
    return tutors[0] ? new Tutor(tutors[0]) : null;
  }

  /**
   * Actualiza los datos de un tutor
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Tutor>} - Tutor actualizado
   */
  async update(updateData) {
    await pool.query(
      'UPDATE tutors SET ? WHERE id = ?',
      [updateData, this.id]
    );
    return await Tutor.findById(this.id);
  }

  /**
   * Elimina un tutor de la base de datos
   * @returns {Promise<boolean>} - True si se eliminó correctamente
   */
  async delete() {
    await pool.query(
      'DELETE FROM tutors WHERE id = ?',
      [this.id]
    );
    return true;
  }

  /**
   * Obtiene los cursos asignados a este tutor
   * @returns {Promise<Array>} - Lista de cursos
   */
  async getCourses() {
    const [courses] = await pool.query(
      'SELECT id, name FROM courses WHERE tutor_id = ?',
      [this.id]
    );
    return courses;
  }

  /**
   * Obtiene los estudiantes asignados a este tutor
   * @returns {Promise<Array>} - Lista de estudiantes
   */
  async getStudents() {
    const [students] = await pool.query(
      'SELECT id, name FROM students WHERE tutor_id = ?',
      [this.id]
    );
    return students;
  }

  /**
   * Obtiene las reseñas de este tutor
   * @returns {Promise<Array>} - Lista de reseñas
   */
  async getReviews() {
    const [reviews] = await pool.query(
      'SELECT id, comment, rating FROM reviews WHERE tutor_id = ?',
      [this.id]
    );
    return reviews;
  }

  /**
   * Formato simplificado para respuestas API
   * @returns {Object} - Representación pública del tutor
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      position: this.position,
      specialization: this.specialization,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

export default Tutor;