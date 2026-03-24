const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();

// ✅ Prevent multiple Prisma instances (important for Vercel)
const prisma = global.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

// ✅ CORS config
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://10.48.225.252:3000',
    "https://nephological-supersecurely-fae.ngrok-free.dev",
    "https://homeiz-trial-three.vercel.app"
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());

/* ===================== ROUTES ===================== */

// ✅ Get posts (with pagination + reactions)
app.get('/api/posts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
          comments: {
            include: {
              user: true,
              replies: {
                include: {
                  user: true,
                  replies: {
                    include: { user: true }
                  }
                }
              }
            }
          },
          likes: true,
          _count: {
            select: {
              comments: true,
              likes: true
            }
          }
        }
      }),
      prisma.post.count()
    ]);

    const postsWithReactions = posts.map(post => {
      const reactionCounts = {};
      post.likes.forEach(like => {
        const type = like.reaction;
        reactionCounts[type] = (reactionCounts[type] || 0) + 1;
      });

      return { ...post, reactionCounts };
    });

    res.json({
      data: postsWithReactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Get single post
app.get('/api/posts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid post id" });
    }

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        user: true,
        comments: {
          include: {
            user: true,
            replies: {
              include: {
                user: true,
                replies: {
                  include: { user: true }
                }
              }
            }
          }
        },
        likes: true
      }
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json({ data: post });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Counts
app.get('/api/posts/:id/counts', async (req, res) => {
  try {
    const postId = parseInt(req.params.id);

    const [likeCount, commentCount] = await Promise.all([
      prisma.like.count({ where: { postId } }),
      prisma.comment.count({ where: { postId } })
    ]);

    res.json({ postId, likeCount, commentCount });

  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Comments with pagination
app.get('/api/posts/:id/comments', async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    const comments = await prisma.comment.findMany({
      where: { postId },
      include: {
        user: true,
        replies: {
          include: { user: true }
        }
      },
      skip,
      take: limit,
      orderBy: { id: 'desc' }
    });

    const total = await prisma.comment.count({ where: { postId } });

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: comments
    });

  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Reaction
app.post('/api/posts/:id/reaction', async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const { userId, reaction } = req.body;

    if (!userId || !reaction) {
      return res.status(400).json({ error: "userId and reaction required" });
    }

    const like = await prisma.like.upsert({
      where: {
        userId_postId: { userId, postId }
      },
      update: { reaction },
      create: { userId, postId, reaction }
    });

    res.json(like);

  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Add comment
app.post('/api/posts/:id/comment', async (req, res) => {
  try {
    const { userId, text } = req.body;
    const postId = parseInt(req.params.id);

    const comment = await prisma.comment.create({
      data: { userId, postId, text }
    });

    res.json(comment);

  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Reply
app.post('/api/comments/:id/reply', async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const { userId, text, parentId } = req.body;

    if (!userId || !text) {
      return res.status(400).json({ error: "userId and text required" });
    }

    const reply = await prisma.commentReply.create({
      data: {
        text,
        userId,
        commentId,
        parentId: parentId || null
      },
      include: { user: true }
    });

    res.json(reply);

  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===================== EXPORT (IMPORTANT) ===================== */

// ❌ NO app.listen()
// ✅ Export for Vercel
module.exports = app;