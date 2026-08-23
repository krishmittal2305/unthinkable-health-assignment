const { Router } = require("express");
const doctorAppointmentController = require("../controllers/doctorAppointmentController");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");

// Mounted at /api/doctor/appointments — doctor-only. Doctors see the AI
// pre-visit summary here before the visit; post-visit notes/prescription
// submission is added in Step 12.
const doctorAppointmentRouter = Router();

doctorAppointmentRouter.use(requireAuth, requireRole("DOCTOR"));

doctorAppointmentRouter.get("/", asyncHandler(doctorAppointmentController.listMyPatients));
doctorAppointmentRouter.get("/:appointmentId", asyncHandler(doctorAppointmentController.getAppointment));

module.exports = { doctorAppointmentRouter };
