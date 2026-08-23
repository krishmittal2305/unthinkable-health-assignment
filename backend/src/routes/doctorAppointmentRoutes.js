const { Router } = require("express");
const doctorAppointmentController = require("../controllers/doctorAppointmentController");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");

const doctorAppointmentRouter = Router();

doctorAppointmentRouter.use(requireAuth, requireRole("DOCTOR"));

doctorAppointmentRouter.get("/", asyncHandler(doctorAppointmentController.listMyPatients));
doctorAppointmentRouter.get("/:appointmentId", asyncHandler(doctorAppointmentController.getAppointment));
doctorAppointmentRouter.post(
  "/:appointmentId/regenerate-pre-visit-summary",
  asyncHandler(doctorAppointmentController.regeneratePreVisitSummary),
);
doctorAppointmentRouter.post(
  "/:appointmentId/post-visit",
  asyncHandler(doctorAppointmentController.submitPostVisitNotes),
);

module.exports = { doctorAppointmentRouter };
