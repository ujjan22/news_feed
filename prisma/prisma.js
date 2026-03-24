const { PrismaClient } = require("../generated/prisma");
const {PrismaPg}= require("@prisma/adapter-pg");
require('dotenv').config()
const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

module.exports = { prisma }