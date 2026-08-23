const { Router } = require("express");
const calendarController = require("../controllers/calendarController");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");

const calendarRouter = Router();

calendarRouter.get("/connect", requireAuth, requireRole("DOCTOR"), asyncHandler(calendarController.connect));

calendarRouter.get("/callback", asyncHandler(calendarController.callback));

module.exports = { calendarRouter };
