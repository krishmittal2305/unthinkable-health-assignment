const { Router } = require("express");
const adminAppointmentController = require("../controllers/adminAppointmentController");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");

const adminAppointmentRouter = Router();

adminAppointmentRouter.use(requireAuth, requireRole("ADMIN"));
adminAppointmentRouter.get("/", asyncHandler(adminAppointmentController.listAllAppointments));

module.exports = { adminAppointmentRouter };
