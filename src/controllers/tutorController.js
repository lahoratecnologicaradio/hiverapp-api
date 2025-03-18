const getTutorDetails = (req, res) => {
  const tutorInfo = {
    name: 'Jonathan Williams',
    position: 'Senior UI/UX Designer at Google',
    courses: [{ id: 1, name: 'Curso 1' }, { id: 2, name: 'Curso 2' }],
    students: [{ id: 1, name: 'Estudiante 1' }, { id: 2, name: 'Estudiante 2' }],
    reviews: [{ id: 1, comment: 'Excelente tutor' }, { id: 2, comment: 'Muy bueno' }],
  };

  res.json(tutorInfo);
};

module.exports = { getTutorDetails };
