const bcrypt = require("bcryptjs");
const { AppError } = require("../lib/errors");
const { signToken } = require("../lib/jwt");
const { prisma } = require("../lib/prisma");
const notificationService = require("./notificationService");

const SALT_ROUNDS = 10;

async function createUser(input) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      phone: input.phone,
      role: input.role,
    },
  });

  await notificationService.createNotification({
    channel: "EMAIL",
    type: "ACCOUNT_CREATED",
    recipientId: user.id,
    payload: { role: user.role },
  });
  notificationService.triggerBestEffortDelivery();

  return user;
}

async function login(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError(401, "Invalid email or password");
  }

  const token = signToken({ userId: user.id, role: user.role });
  return { token, user };
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone,
  };
}

module.exports = { createUser, login, toPublicUser };
