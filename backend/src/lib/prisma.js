const { PrismaClient } = require("@prisma/client");

// Reuse a single PrismaClient instance across dev reloads to avoid
// exhausting the DB connection pool.
const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

module.exports = { prisma };
