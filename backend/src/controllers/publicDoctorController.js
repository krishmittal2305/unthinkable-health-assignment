const availabilityService = require("../services/availabilityService");
const doctorService = require("../services/doctorService");
const { AppError } = require("../lib/errors");

async function searchDoctors(req, res) {
  const specialisation = typeof req.query.specialisation === "string" ? req.query.specialisation : undefined;
  const doctors = await doctorService.searchDoctors({ specialisation });
  res.json({ doctors });
}

async function getDoctor(req, res) {
  const doctor = await doctorService.getSearchResultById(req.params.doctorId);
  res.json({ doctor });
}

async function getAvailability(req, res) {
  const { date } = req.query;
  if (typeof date !== "string") {
    throw new AppError(400, "date query param is required (YYYY-MM-DD)");
  }

  const availability = await availabilityService.getAvailableSlots(req.params.doctorId, date);
  res.json(availability);
}

module.exports = { searchDoctors, getDoctor, getAvailability };
