const doctorService = require("../services/doctorService");
const leaveService = require("../services/leaveService");
const {
  createDoctorSchema,
  updateDoctorProfileSchema,
  leaveDaySchema,
} = require("../validation/doctorSchemas");

async function createDoctor(req, res) {
  const input = createDoctorSchema.parse(req.body);
  const doctor = await doctorService.createDoctor(input);
  res.status(201).json({ doctor });
}

async function listDoctors(req, res) {
  const specialisation = typeof req.query.specialisation === "string" ? req.query.specialisation : undefined;
  const doctors = await doctorService.listDoctors({ specialisation });
  res.json({ doctors });
}

async function getDoctor(req, res) {
  const doctor = await doctorService.getDoctorById(req.params.doctorId);
  res.json({ doctor });
}

async function updateDoctor(req, res) {
  const input = updateDoctorProfileSchema.parse(req.body);
  const doctor = await doctorService.updateDoctorProfile(req.params.doctorId, input);
  res.json({ doctor });
}

async function deleteDoctor(req, res) {
  await doctorService.deleteDoctor(req.params.doctorId);
  res.status(204).send();
}

async function addLeaveDay(req, res) {
  const input = leaveDaySchema.parse(req.body);
  const { leaveDay, cancelledAppointmentCount } = await leaveService.markDoctorOnLeave(
    req.params.doctorId,
    input,
  );
  res.status(201).json({ leaveDay, cancelledAppointmentCount });
}

async function removeLeaveDay(req, res) {
  await doctorService.removeLeaveDay(req.params.doctorId, req.params.leaveDayId);
  res.status(204).send();
}

module.exports = {
  createDoctor,
  listDoctors,
  getDoctor,
  updateDoctor,
  deleteDoctor,
  addLeaveDay,
  removeLeaveDay,
};
