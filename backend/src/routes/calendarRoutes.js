const { Router } = require("express");
const calendarController = require("../controllers/calendarController");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");

const calendarRouter = Router();

// Doctor-initiated: get the Google consent URL to redirect the browser to.
calendarRouter.get("/connect", requireAuth, requireRole("DOCTOR"), asyncHandler(calendarController.connect));

// Public: Google redirects here directly after consent, with no Bearer
// token available. Authorization for which doctor is handled inside the
// controller via the signed `state` param.
calendarRouter.get("/callback", asyncHandler(calendarController.callback));

module.exports = { calendarRouter };
