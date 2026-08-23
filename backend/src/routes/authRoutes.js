const { Router } = require("express");
const authController = require("../controllers/authController");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimit");

const authRouter = Router();

const authAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many attempts. Please try again in a few minutes.",
});

authRouter.post("/register", authAttemptLimiter, asyncHandler(authController.registerPatient));
authRouter.post("/login", authAttemptLimiter, asyncHandler(authController.login));
authRouter.get("/me", requireAuth, asyncHandler(authController.me));
authRouter.post(
  "/admin/users",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(authController.adminCreateUser),
);

module.exports = { authRouter };
