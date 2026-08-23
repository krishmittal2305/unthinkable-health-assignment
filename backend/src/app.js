const cors = require("cors");
const express = require("express");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { authRouter } = require("./routes/authRoutes");
const { adminDoctorRouter } = require("./routes/doctorRoutes");
const { publicDoctorRouter } = require("./routes/publicDoctorRoutes");

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/admin/doctors", adminDoctorRouter);
  app.use("/api/doctors", publicDoctorRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
