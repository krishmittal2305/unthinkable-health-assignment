const { AppError } = require("../lib/errors");
const { prisma } = require("../lib/prisma");
const authService = require("../services/authService");
const { adminCreateUserSchema, loginSchema, registerPatientSchema } = require("../validation/authSchemas");

async function registerPatient(req, res) {
  const input = registerPatientSchema.parse(req.body);

  const user = await authService.createUser({ ...input, role: "PATIENT" });
  const { token } = await authService.login(input.email, input.password);

  res.status(201).json({ token, user: authService.toPublicUser(user) });
}

async function login(req, res) {
  const input = loginSchema.parse(req.body);

  const { token, user } = await authService.login(input.email, input.password);

  res.json({ token, user: authService.toPublicUser(user) });
}

async function me(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  if (!user) {
    throw new AppError(404, "User not found");
  }

  res.json({ user: authService.toPublicUser(user) });
}

async function adminCreateUser(req, res) {
  const input = adminCreateUserSchema.parse(req.body);

  const user = await authService.createUser(input);

  res.status(201).json({ user: authService.toPublicUser(user) });
}

module.exports = { registerPatient, login, me, adminCreateUser };
