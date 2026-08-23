const cors = require("cors");
const express = require("express");
const { env } = require("./lib/env");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { authRouter } = require("./routes/authRoutes");
const { adminDoctorRouter } = require("./routes/doctorRoutes");
const { publicDoctorRouter } = require("./routes/publicDoctorRoutes");
const { appointmentRouter } = require("./routes/appointmentRoutes");
const { doctorAppointmentRouter } = require("./routes/doctorAppointmentRoutes");
const { calendarRouter } = require("./routes/calendarRoutes");
const { adminAppointmentRouter } = require("./routes/adminAppointmentRoutes");

function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(cors({ origin: env.frontendUrl }));
  app.use(express.json());

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/admin/doctors", adminDoctorRouter);
  app.use("/api/doctors", publicDoctorRouter);
  app.use("/api/appointments", appointmentRouter);
  app.use("/api/doctor/appointments", doctorAppointmentRouter);
  app.use("/api/doctor/calendar", calendarRouter);
  app.use("/api/admin/appointments", adminAppointmentRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
