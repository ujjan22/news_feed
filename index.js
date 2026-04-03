// api/index.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

/* =======================
   SERVERLESS-SAFE MONGODB CONNECTION
======================= */
let cached = global.mongoose;
if (!cached) cached = global.mongoose = { conn: null, promise: null };

async function connectToDatabase() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    const opts = { useNewUrlParser: true, useUnifiedTopology: true };
    cached.promise = mongoose.connect(process.env.MONGO_URL, opts).then(m => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

/* =======================
   MODELS
======================= */

// USER
const userSchema = new mongoose.Schema({
  name: String,
  profile: String,
  role: { type: String, enum: ["ADMIN", "GUEST"], default: "GUEST" },
}, { timestamps: true });
const User = mongoose.models.User || mongoose.model("User", userSchema);

// POST
const postSchema = new mongoose.Schema({
  content: String,
  image: String,
  location: String,
  user: { _id: mongoose.Schema.Types.ObjectId, name: String, profile: String },
  reactions: [{
    user: mongoose.Schema.Types.ObjectId,
    type: { type: String, enum: ["LIKE", "LOVE", "HAHA", "WOW", "SAD", "ANGRY"] }
  }],
  reactionCounts: {
    LIKE: { type: Number, default: 0 },
    LOVE: { type: Number, default: 0 },
    HAHA: { type: Number, default: 0 },
    WOW: { type: Number, default: 0 },
    SAD: { type: Number, default: 0 },
    ANGRY: { type: Number, default: 0 },
  },
  commentsCount: { type: Number, default: 0 }
}, { timestamps: true });
postSchema.index({ createdAt: -1 });
const Post = mongoose.models.Post || mongoose.model("Post", postSchema);

// COMMENT
const commentSchema = new mongoose.Schema({
  text: String,
  user: { _id: mongoose.Schema.Types.ObjectId, name: String, profile: String },
  postId: mongoose.Schema.Types.ObjectId
}, { timestamps: true });
commentSchema.index({ postId: 1 });
const Comment = mongoose.models.Comment || mongoose.model("Comment", commentSchema);

// REPLY
const replySchema = new mongoose.Schema({
  text: String,
  user: { _id: mongoose.Schema.Types.ObjectId, name: String, profile: String },
  commentId: mongoose.Schema.Types.ObjectId,
  parentId: { type: mongoose.Schema.Types.ObjectId, default: null }
}, { timestamps: true });
const Reply = mongoose.models.Reply || mongoose.model("Reply", replySchema);

/* =======================
   HELPERS
======================= */
const getRandomPostImage = () => `https://picsum.photos/seed/post-${Date.now()}/600/400`;

/* =======================
   ROUTES
======================= */
app.get("/posts", async (req, res) => {
  await connectToDatabase();
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    Post.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    Post.countDocuments()
  ]);

  res.json({ data: posts, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
});

app.post("/posts", async (req, res) => {
  await connectToDatabase();
  try {
    const { content, userId } = req.body;
    if (!content || !userId) return res.status(400).json({ error: "content and userId required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const post = await Post.create({
      content,
      image: getRandomPostImage(),
      user: { _id: user._id, name: user.name, profile: user.profile }
    });
    res.status(201).json(post);
  } catch {
    res.status(500).json({ error: "Error creating post" });
  }
});

app.get("/posts/:id", async (req, res) => {
  await connectToDatabase();
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json(post);
});

app.get("/users/:id", async (req, res) => {
  await connectToDatabase();
  const user = await User.findById(req.params.id).select("name profile _id");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

app.post("/posts/:id/reaction", async (req, res) => {
  await connectToDatabase();
  const { userId, reaction } = req.body;
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });

  const existing = post.reactions.find(r => r.user.toString() === userId);
  if (existing) {
    post.reactionCounts[existing.type]--;
    existing.type = reaction;
  } else {
    post.reactions.push({ user: userId, type: reaction });
  }
  post.reactionCounts[reaction]++;
  await post.save();
  res.json(post.reactionCounts);
});

app.post("/posts/:id/comment", async (req, res) => {
  await connectToDatabase();
  const { userId, text } = req.body;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const comment = await Comment.create({
    text,
    postId: req.params.id,
    user: { _id: user._id, name: user.name, profile: user.profile }
  });

  await Post.findByIdAndUpdate(req.params.id, { $inc: { commentsCount: 1 } });
  res.json(comment);
});

app.get("/posts/:id/comments", async (req, res) => {
  await connectToDatabase();
  const comments = await Comment.find({ postId: req.params.id }).sort({ createdAt: -1 }).limit(10);
  res.json(comments);
});

app.post("/comments/:id/reply", async (req, res) => {
  await connectToDatabase();
  const { userId, text, parentId } = req.body;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const reply = await Reply.create({
    text,
    commentId: req.params.id,
    parentId: parentId || null,
    user: { _id: user._id, name: user.name, profile: user.profile }
  });

  res.json(reply);
});

module.exports = app;