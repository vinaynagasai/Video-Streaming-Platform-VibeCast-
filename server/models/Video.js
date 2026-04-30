const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    authorName: {
      type: String,
      required: true,
      trim: true
    },
    text: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: true,
    _id: true
  }
);

const videoSchema = new mongoose.Schema(
  {
    videoId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    creatorName: {
      type: String,
      required: true,
      trim: true,
      default: "Independent Creator",
      index: true
    },
    tags: {
      type: [String],
      default: [],
      set: (value) =>
        Array.from(
          new Set(
            (Array.isArray(value) ? value : [])
              .map((tag) => String(tag || "").trim().toLowerCase())
              .filter(Boolean)
          )
        )
    },
    originalName: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    inputPath: {
      type: String,
      required: true
    },
    outputDir: {
      type: String,
      required: true
    },
    streamPath: {
      type: String,
      required: true
    },
    streamUrl: {
      type: String,
      required: true
    },
    thumbnailUrl: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: ["processing", "ready", "failed"],
      default: "ready"
    },
    views: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    totalWatchTimeSeconds: {
      type: Number,
      default: 0
    },
    averageWatchTimeSeconds: {
      type: Number,
      default: 0
    },
    completedViews: {
      type: Number,
      default: 0
    },
    commentsCount: {
      type: Number,
      default: 0
    },
    comments: {
      type: [commentSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Video", videoSchema);
