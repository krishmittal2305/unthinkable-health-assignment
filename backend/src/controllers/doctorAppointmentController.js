const appointmentService = require("../services/appointmentService");

async function listMyPatients(req, res) {
  const appointments = await appointmentService.listForDoctor(req.user.userId);
  res.json({ appointments });
}

async function getAppointment(req, res) {
  const appointment = await appointmentService.getForDoctor(req.user.userId, req.params.appointmentId);
  res.json({ appointment });
}

module.exports = { listMyPatients, getAppointment };
