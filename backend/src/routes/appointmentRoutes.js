const { Router } = require("express");
const appointmentController = require("../controllers/appointmentController");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");

const appointmentRouter = Router();

appointmentRouter.use(requireAuth, requireRole("PATIENT"));

appointmentRouter.post("/hold", asyncHandler(appointmentController.holdSlot));
appointmentRouter.post("/confirm", asyncHandler(appointmentController.confirmBooking));
appointmentRouter.get("/mine", asyncHandler(appointmentController.listMyAppointments));
appointmentRouter.post("/:appointmentId/cancel", asyncHandler(appointmentController.cancelAppointment));

module.exports = { appointmentRouter };
