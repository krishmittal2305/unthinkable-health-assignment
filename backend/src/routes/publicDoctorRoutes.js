const { Router } = require("express");
const publicDoctorController = require("../controllers/publicDoctorController");
const { asyncHandler } = require("../middleware/asyncHandler");

const publicDoctorRouter = Router();

publicDoctorRouter.get("/", asyncHandler(publicDoctorController.searchDoctors));
publicDoctorRouter.get("/:doctorId", asyncHandler(publicDoctorController.getDoctor));
publicDoctorRouter.get("/:doctorId/availability", asyncHandler(publicDoctorController.getAvailability));

module.exports = { publicDoctorRouter };
