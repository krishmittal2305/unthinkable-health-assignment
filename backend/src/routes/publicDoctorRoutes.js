const { Router } = require("express");
const publicDoctorController = require("../controllers/publicDoctorController");
const { asyncHandler } = require("../middleware/asyncHandler");

// Mounted at /api/doctors — public, no auth. Patients (and anonymous
// visitors) search doctors and browse availability before ever logging in;
// only the actual booking step (Step 6) requires a patient session.
const publicDoctorRouter = Router();

publicDoctorRouter.get("/", asyncHandler(publicDoctorController.searchDoctors));
publicDoctorRouter.get("/:doctorId/availability", asyncHandler(publicDoctorController.getAvailability));

module.exports = { publicDoctorRouter };
