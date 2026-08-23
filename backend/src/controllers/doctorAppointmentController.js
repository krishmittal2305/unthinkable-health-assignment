const appointmentService = require("../services/appointmentService");
const postVisitService = require("../services/postVisitService");
const { postVisitNotesSchema } = require("../validation/postVisitSchemas");

async function listMyPatients(req, res) {
  const appointments = await appointmentService.listForDoctor(req.user.userId);
  res.json({ appointments });
}

async function getAppointment(req, res) {
  const appointment = await appointmentService.getForDoctor(req.user.userId, req.params.appointmentId);
  res.json({ appointment });
}

async function submitPostVisitNotes(req, res) {
  const input = postVisitNotesSchema.parse(req.body);
  const result = await postVisitService.submitPostVisitNotes(req.user.userId, req.params.appointmentId, input);
  res.status(201).json(result);
}

module.exports = { listMyPatients, getAppointment, submitPostVisitNotes };
