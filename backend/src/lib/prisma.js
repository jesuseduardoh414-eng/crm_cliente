// Instancia singleton de Prisma Client
// Esto evita crear múltiples conexiones en desarrollo con hot-reload
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
