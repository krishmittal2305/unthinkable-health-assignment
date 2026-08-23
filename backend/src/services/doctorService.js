const { AppError } = require("../lib/errors");
const { prisma } = require("../lib/prisma");
const authService = require("./authService");

function toPublicDoctor(doctorProfile) {
  return {
    id: doctorProfile.id,
    specialisation: doctorProfile.specialisation,
    workingHours: doctorProfile.workingHours,
    slotDurationMins: doctorProfile.slotDurationMins,
    user: authService.toPublicUser(doctorProfile.user),
    leaveDays: doctorProfile.leaveDays?.map((leaveDay) => ({
      id: leaveDay.id,
      date: leaveDay.date,
      reason: leaveDay.reason,
    })),
  };
}

function toSearchResult(doctorProfile) {
  return {
    id: doctorProfile.id,
    name: doctorProfile.user.name,
    specialisation: doctorProfile.specialisation,
    slotDurationMins: doctorProfile.slotDurationMins,
  };
}

async function searchDoctors({ specialisation } = {}) {
  const doctorProfiles = await prisma.doctorProfile.findMany({
    where: specialisation ? { specialisation: { equals: specialisation, mode: "insensitive" } } : undefined,
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return doctorProfiles.map(toSearchResult);
}

async function getSearchResultById(doctorId) {
  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    include: { user: true },
  });
  if (!doctorProfile) {
    throw new AppError(404, "Doctor not found");
  }
  return toSearchResult(doctorProfile);
}

async function createDoctor(input) {
  const user = await authService.createUser({
    email: input.email,
    password: input.password,
    name: input.name,
    phone: input.phone,
    role: "DOCTOR",
  });

  const doctorProfile = await prisma.doctorProfile.create({
    data: {
      userId: user.id,
      specialisation: input.specialisation,
      workingHours: input.workingHours,
      slotDurationMins: input.slotDurationMins,
    },
    include: { user: true, leaveDays: true },
  });

  return toPublicDoctor(doctorProfile);
}

async function listDoctors({ specialisation } = {}) {
  const doctorProfiles = await prisma.doctorProfile.findMany({
    where: specialisation ? { specialisation: { equals: specialisation, mode: "insensitive" } } : undefined,
    include: { user: true, leaveDays: true },
    orderBy: { createdAt: "asc" },
  });

  return doctorProfiles.map(toPublicDoctor);
}

async function getDoctorById(doctorId) {
  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    include: { user: true, leaveDays: true },
  });

  if (!doctorProfile) {
    throw new AppError(404, "Doctor not found");
  }

  return toPublicDoctor(doctorProfile);
}

async function updateDoctorProfile(doctorId, updates) {
  await getDoctorById(doctorId);

  const doctorProfile = await prisma.doctorProfile.update({
    where: { id: doctorId },
    data: updates,
    include: { user: true, leaveDays: true },
  });

  return toPublicDoctor(doctorProfile);
}

async function deleteDoctor(doctorId) {
  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
  });

  if (!doctorProfile) {
    throw new AppError(404, "Doctor not found");
  }

  const activeAppointmentCount = await prisma.appointment.count({
    where: {
      doctorId,
      status: { in: ["BOOKED", "COMPLETED"] },
    },
  });

  if (activeAppointmentCount > 0) {
    throw new AppError(
      409,
      "This doctor has existing appointments and cannot be deleted. Use leave days to block future bookings instead.",
    );
  }

  await prisma.user.delete({ where: { id: doctorProfile.userId } });
}

async function removeLeaveDay(doctorId, leaveDayId) {
  const leaveDay = await prisma.leaveDay.findUnique({ where: { id: leaveDayId } });
  if (!leaveDay || leaveDay.doctorId !== doctorId) {
    throw new AppError(404, "Leave day not found");
  }

  await prisma.leaveDay.delete({ where: { id: leaveDayId } });
}

module.exports = {
  toPublicDoctor,
  toSearchResult,
  searchDoctors,
  getSearchResultById,
  createDoctor,
  listDoctors,
  getDoctorById,
  updateDoctorProfile,
  deleteDoctor,
  removeLeaveDay,
};
