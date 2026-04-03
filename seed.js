require("dotenv").config();
const mongoose = require("mongoose");

/* =======================
   CONNECT DB
======================= */
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB Connected for seeding"))
  .catch(err => console.error(err));

/* =======================
   MODELS (same as app)
======================= */

const userSchema = new mongoose.Schema({
  name: String,
  profile: String,
  role: {
    type: String,
    enum: ["ADMIN", "GUEST"],
    default: "GUEST"
  }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

const postSchema = new mongoose.Schema({
  content: String,
  image: String,
  location: String,

  user: {
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    profile: String
  },

  reactions: [
    {
      user: mongoose.Schema.Types.ObjectId,
      type: {
        type: String,
        enum: ["LIKE", "LOVE", "HAHA", "WOW", "SAD", "ANGRY"]
      }
    }
  ],

  reactionCounts: {
    LIKE: { type: Number, default: 0 },
    LOVE: { type: Number, default: 0 },
    HAHA: { type: Number, default: 0 },
    WOW: { type: Number, default: 0 },
    SAD: { type: Number, default: 0 },
    ANGRY: { type: Number, default: 0 }
  },

  commentsCount: { type: Number, default: 0 }

}, { timestamps: true });

const Post = mongoose.model("Post", postSchema);

/* =======================
   HELPERS
======================= */

const getRandomPostImage = (id) =>
  `https://picsum.photos/seed/post-${id}/600/400`;

const getRandomProfile = (id) =>
  `https://i.pravatar.cc/150?img=${id}`;

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

const reactions = ["LIKE", "LOVE", "HAHA", "WOW", "SAD", "ANGRY"];

/* =======================
   SEED FUNCTION
======================= */

async function seed() {
  try {
    console.log("🌱 Seeding started...");

    // Cleanup
    await User.deleteMany();
    await Post.deleteMany();

    // ✅ Create Users
    const users = [];

    for (let i = 1; i <= 10; i++) {
      const user = await User.create({
        name: `User ${i}`,
        role: i % 2 === 0 ? "ADMIN" : "GUEST",
        profile: getRandomProfile(i)
      });

      users.push(user);
    }

    // ✅ Create Posts
    for (let i = 1; i <= 20; i++) {
      const randomUser = getRandomUser(users);

      // random reactions (optional realism)
      const randomReactions = [];
      const reactionCounts = {
        LIKE: 0,
        LOVE: 0,
        HAHA: 0,
        WOW: 0,
        SAD: 0,
        ANGRY: 0
      };

      const numberOfReactions = Math.floor(Math.random() * 5);

      for (let j = 0; j < numberOfReactions; j++) {
        const randomUserForReaction = getRandomUser(users);
        const randomReaction =
          reactions[Math.floor(Math.random() * reactions.length)];

        randomReactions.push({
          user: randomUserForReaction._id,
          type: randomReaction
        });

        reactionCounts[randomReaction]++;
      }

      await Post.create({
        content: `Random Post ${i}`,
        image: getRandomPostImage(i),
        location: getRandomLocation(),

        user: {
          _id: randomUser._id,
          name: randomUser.name,
          profile: randomUser.profile
        },

        reactions: randomReactions,
        reactionCounts,
        commentsCount: Math.floor(Math.random() * 10)
      });
    }

    console.log("✅ Seeding completed!");
    process.exit();

  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

seed();