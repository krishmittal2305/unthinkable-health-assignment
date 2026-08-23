const { Router } = require("express");
const authController = require("../controllers/authController");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");

const authRouter = Router();

authRouter.post("/register", asyncHandler(authController.registerPatient));
authRouter.post("/login", asyncHandler(authController.login));
authRouter.get("/me", requireAuth, asyncHandler(authController.me));
authRouter.post(
  "/admin/users",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(authController.adminCreateUser),
);

module.exports = { authRouter };
