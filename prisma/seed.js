const { PrismaClient } = require("../generated/prisma");
const {PrismaPg}= require("@prisma/adapter-pg");
require('dotenv').config()
const connectionString = `${ process.env["DATABASE_URL"]}`;
console.log(connectionString);
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Random generators
const getRandomPostImage = (id) => `https://picsum.photos/seed/post-${id}/600/400`;
const getRandomProfile = (id) => `https://i.pravatar.cc/150?img=${id}`;

const locations = [
  "New York, USA",
  "London, UK",
  "Tokyo, Japan",
  "Kathmandu, Nepal",
  "Paris, France",
  "Sydney, Australia",
  "Berlin, Germany"
];

const getRandomLocation = () =>
  locations[Math.floor(Math.random() * locations.length)];

const getRandomUser = (users) =>
  users[Math.floor(Math.random() * users.length)];

async function main() {
  // Cleanup
  await prisma.like.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();

  // ✅ Create 10 users
  const users = [];

  for (let i = 1; i <= 10; i++) {
    const user = await prisma.user.create({
      data: {
        name: `User ${i}`,
        role: i % 2 === 0 ? "ADMIN" : "GUEST",
        profile: getRandomProfile(i),
      },
    });

    users.push(user);
  }

  // ✅ Create 20 random posts
  for (let i = 1; i <= 20; i++) {
    const randomUser = getRandomUser(users);

    await prisma.post.create({
      data: {
        content: `Random Post ${i}`,
        image: getRandomPostImage(i),
        location: getRandomLocation(),
        userId: randomUser.id,
      },
    });
  }

  console.log("🌱 Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });