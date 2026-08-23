const appointmentService = require("../services/appointmentService");

async function listAllAppointments(_req, res) {
  const appointments = await appointmentService.listAllForAdmin();
  res.json({ appointments });
}

module.exports = { listAllAppointments };
