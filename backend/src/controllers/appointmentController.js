const appointmentService = require("../services/appointmentService");
const { confirmBookingSchema, holdSlotSchema } = require("../validation/appointmentSchemas");

async function holdSlot(req, res) {
  const input = holdSlotSchema.parse(req.body);
  const hold = await appointmentService.createHold(req.user.userId, input);
  res.status(201).json({ hold });
}

async function confirmBooking(req, res) {
  const input = confirmBookingSchema.parse(req.body);
  const appointment = await appointmentService.confirmBooking(req.user.userId, input);
  res.status(201).json({ appointment });
}

async function listMyAppointments(req, res) {
  const appointments = await appointmentService.listMyAppointments(req.user.userId);
  res.json({ appointments });
}

async function cancelAppointment(req, res) {
  const appointment = await appointmentService.cancelAppointment(req.user.userId, req.params.appointmentId);
  res.json({ appointment });
}

module.exports = { holdSlot, confirmBooking, listMyAppointments, cancelAppointment };
