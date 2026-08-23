const { Router } = require("express");
const doctorController = require("../controllers/doctorController");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");

// Mounted at /api/admin/doctors — every route here is admin-only.
// (Public doctor search for patients is a separate route added in Step 5.)
const adminDoctorRouter = Router();

adminDoctorRouter.use(requireAuth, requireRole("ADMIN"));

adminDoctorRouter.post("/", asyncHandler(doctorController.createDoctor));
adminDoctorRouter.get("/", asyncHandler(doctorController.listDoctors));
adminDoctorRouter.get("/:doctorId", asyncHandler(doctorController.getDoctor));
adminDoctorRouter.patch("/:doctorId", asyncHandler(doctorController.updateDoctor));
adminDoctorRouter.delete("/:doctorId", asyncHandler(doctorController.deleteDoctor));

adminDoctorRouter.post("/:doctorId/leave-days", asyncHandler(doctorController.addLeaveDay));
adminDoctorRouter.delete("/:doctorId/leave-days/:leaveDayId", asyncHandler(doctorController.removeLeaveDay));

module.exports = { adminDoctorRouter };
