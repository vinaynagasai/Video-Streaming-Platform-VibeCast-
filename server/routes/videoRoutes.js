const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const transcodeVideo = require("../ffmpeg/transcoder");
const Video = require("../models/Video");

const router = express.Router();
const uploadsDir = path.join(__dirname, "..", "uploads");
const transcodedDir = path.join(__dirname, "..", "transcoded");
const bundledSampleVideos = [
  {
    videoId: "1777283494686",
    title: "City Lights Timelapse",
    description: "A bundled sample stream for testing playback, feed cards, and watch analytics.",
    creatorName: "VibeCast Studio",
    tags: ["music", "cinematic", "city"],
    originalName: "city-lights-sample.mp4",
    filename: "city-lights-sample.mp4",
    views: 2841,
    likes: 198,
    commentsCount: 14
  },
  {
    videoId: "1777282891827",
    title: "Mountain Drive",
    description: "Scenic road footage included with the project as a ready-to-play sample video.",
    creatorName: "Open Road Media",
    tags: ["travel", "outdoors", "cinematic"],
    originalName: "mountain-drive-sample.mp4",
    filename: "mountain-drive-sample.mp4",
    views: 1934,
    likes: 121,
    commentsCount: 8
  },
  {
    videoId: "1777282345451",
    title: "Neon Night Walk",
    description: "A short urban clip used to demonstrate adaptive streaming and the watch page.",
    creatorName: "Afterglow Films",
    tags: ["music", "city", "night"],
    originalName: "neon-night-walk.mp4",
    filename: "neon-night-walk.mp4",
    views: 1675,
    likes: 104,
    commentsCount: 6
  },
  {
    videoId: "1776932009655",
    title: "Ocean Breeze",
    description: "Sample seaside footage bundled with the app so the homepage shows real content.",
    creatorName: "Blue Harbor",
    tags: ["travel", "relax", "nature"],
    originalName: "ocean-breeze-sample.mp4",
    filename: "ocean-breeze-sample.mp4",
    views: 1428,
    likes: 86,
    commentsCount: 5
  },
  {
    videoId: "1776931557849",
    title: "Golden Hour Ride",
    description: "A lightweight demo stream for showcasing playback without placeholder cards.",
    creatorName: "Studio North",
    tags: ["music", "travel", "golden hour"],
    originalName: "golden-hour-ride.mp4",
    filename: "golden-hour-ride.mp4",
    views: 1196,
    likes: 73,
    commentsCount: 4
  }
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

const buildAbsoluteUrl = (req, relativePath) => `${req.protocol}://${req.get("host")}${relativePath}`;
const buildStreamPath = (videoId) => `/videos/${videoId}/master.m3u8`;
const buildThumbnailPath = (videoId) => `/videos/${videoId}/thumbnail.jpg`;
const parseTags = (value) =>
  Array.from(
    new Set(
      String(value || "")
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    )
  );

const mapComment = (comment) => ({
  id: comment._id,
  authorName: comment.authorName,
  text: comment.text,
  createdAt: comment.createdAt,
  updatedAt: comment.updatedAt
});

const mapVideoResponse = (req, video, options = {}) => ({
  id: video._id,
  videoId: video.videoId,
  title: video.title,
  description: video.description,
  creatorName: video.creatorName,
  tags: Array.isArray(video.tags) ? video.tags : [],
  originalName: video.originalName,
  streamPath: video.streamPath,
  streamUrl: buildAbsoluteUrl(req, video.streamPath),
  thumbnailUrl: video.thumbnailUrl,
  status: video.status,
  views: video.views,
  likes: video.likes,
  totalWatchTimeSeconds: video.totalWatchTimeSeconds || 0,
  averageWatchTimeSeconds: video.averageWatchTimeSeconds || 0,
  completedViews: video.completedViews || 0,
  commentsCount: video.commentsCount,
  createdAt: video.createdAt,
  updatedAt: video.updatedAt,
  comments: options.includeComments ? (video.comments || []).map(mapComment) : undefined
});

const ensureBundledSampleVideos = async () => {
  await Promise.all(
    bundledSampleVideos.map(async (sample) => {
      const outputDir = transcodeVideo.buildOutputDir(sample.videoId);
      const masterPlaylistPath = path.join(outputDir, "master.m3u8");
      const { tags, ...sampleWithoutTags } = sample;

      if (!fs.existsSync(masterPlaylistPath)) {
        return;
      }

      await Video.updateOne(
        { videoId: sample.videoId },
        {
          $set: {
            tags: tags || []
          },
          $setOnInsert: {
            ...sampleWithoutTags,
            inputPath: path.join(uploadsDir, sample.filename),
            outputDir,
            streamPath: buildStreamPath(sample.videoId),
            streamUrl: buildStreamPath(sample.videoId),
            thumbnailUrl: "",
            status: "ready",
            totalWatchTimeSeconds: 0,
            averageWatchTimeSeconds: 0,
            completedViews: 0,
            comments: []
          }
        },
        { upsert: true }
      );
    })
  );
};

router.post("/upload", upload.fields([{ name: "video", maxCount: 1 }, { name: "thumbnail", maxCount: 1 }]), async (req, res) => {
  try {
    const videoFile = req.files?.video?.[0];
    const thumbnailFile = req.files?.thumbnail?.[0];

    if (!videoFile) {
      return res.status(400).json({ error: "No file uploaded. Use form-data key 'video' as File." });
    }

    const videoId = Date.now().toString();
    const streamPath = buildStreamPath(videoId);
    const streamUrl = buildAbsoluteUrl(req, streamPath);
    const thumbnailPath = buildThumbnailPath(videoId);
    const title = req.body.title?.trim() || path.parse(videoFile.originalname).name;
    const description = req.body.description?.trim() || "";
    const creatorName = req.body.creatorName?.trim() || "Independent Creator";
    const tags = parseTags(req.body.tags);
    const outputDir = transcodeVideo.buildOutputDir(videoId);
    const thumbnailUrl = thumbnailFile
      ? buildAbsoluteUrl(req, `/uploads/${encodeURIComponent(thumbnailFile.filename)}`)
      : buildAbsoluteUrl(req, thumbnailPath);

    const video = await Video.create({
      videoId,
      title,
      description,
      creatorName,
      tags,
      originalName: videoFile.originalname,
      filename: videoFile.filename,
      inputPath: videoFile.path,
      outputDir,
      streamPath,
      streamUrl,
      thumbnailUrl,
      status: "processing"
    });

    transcodeVideo(videoFile.path, { videoId })
      .then(async () => {
        await Video.findOneAndUpdate(
          { videoId },
          {
            status: "ready",
            outputDir,
            streamPath,
            streamUrl,
            thumbnailUrl: thumbnailFile ? thumbnailUrl : buildAbsoluteUrl(req, thumbnailPath)
          },
          { returnDocument: "after" }
        );
      })
      .catch(async (error) => {
        console.error("Upload/transcode failed:", error.message);
        await Video.findOneAndUpdate(
          { videoId },
          { status: "failed" },
          { returnDocument: "after" }
        );
      });

    res.status(202).json({
      message: "Upload received. Transcoding has started.",
      video: mapVideoResponse(req, video)
    });
  } catch (error) {
    console.error("Upload/transcode failed:", error.message);
    res.status(500).json({ error: "Transcoding failed." });
  }
});

router.get("/feed", async (req, res) => {
  try {
    await ensureBundledSampleVideos();
    const videos = await Video.find().sort({ createdAt: -1 }).lean();
    res.json({
      videos: videos.map((video) => mapVideoResponse(req, video))
    });
  } catch (error) {
    console.error("Feed fetch failed:", error.message);
    res.status(500).json({ error: "Unable to fetch feed." });
  }
});

router.get("/dashboard", async (req, res) => {
  try {
    await ensureBundledSampleVideos();
    const creatorName = req.query.creatorName?.trim();

    if (!creatorName) {
      return res.status(400).json({ error: "creatorName query parameter is required." });
    }

    const videos = await Video.find({ creatorName }).sort({ createdAt: -1 }).lean();
    const totals = videos.reduce(
      (accumulator, video) => {
        accumulator.views += video.views || 0;
        accumulator.likes += video.likes || 0;
        accumulator.watchTimeSeconds += video.totalWatchTimeSeconds || 0;
        accumulator.completedViews += video.completedViews || 0;
        accumulator.comments += video.commentsCount || 0;
        return accumulator;
      },
      {
        videos: videos.length,
        views: 0,
        likes: 0,
        watchTimeSeconds: 0,
        completedViews: 0,
        comments: 0
      }
    );

    res.json({
      creatorName,
      totals,
      videos: videos.map((video) => mapVideoResponse(req, video))
    });
  } catch (error) {
    console.error("Dashboard fetch failed:", error.message);
    res.status(500).json({ error: "Unable to fetch dashboard." });
  }
});

router.get("/:videoId/stream", (req, res) => {
  const { videoId } = req.params;
  const masterPlaylistPath = path.join(transcodedDir, videoId, "master.m3u8");

  if (!fs.existsSync(masterPlaylistPath)) {
    return Video.findOne({ videoId })
      .lean()
      .then((video) => {
        if (!video) {
          return res.status(404).json({ error: "Stream not found." });
        }

        if (video.status === "processing") {
          return res.status(409).json({ error: "Video is still processing.", status: video.status });
        }

        if (video.status === "failed") {
          return res.status(422).json({ error: "Video processing failed.", status: video.status });
        }

        return res.status(404).json({ error: "Stream not found." });
      })
      .catch((error) => {
        console.error("Stream lookup failed:", error.message);
        return res.status(500).json({ error: "Unable to load stream." });
      });
  }

  res.json({
    videoId,
    streamPath: buildStreamPath(videoId),
    streamUrl: buildAbsoluteUrl(req, buildStreamPath(videoId))
  });
});

router.post("/:videoId/view", async (req, res) => {
  try {
    await ensureBundledSampleVideos();
    const video = await Video.findOneAndUpdate(
      { videoId: req.params.videoId },
      { $inc: { views: 1 } },
      { returnDocument: "after" }
    );

    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    res.json({
      video: mapVideoResponse(req, video)
    });
  } catch (error) {
    console.error("View update failed:", error.message);
    res.status(500).json({ error: "Unable to update views." });
  }
});

router.post("/:videoId/analytics/watch", async (req, res) => {
  try {
    await ensureBundledSampleVideos();
    const watchedSeconds = Number(req.body.watchedSeconds);
    const completed = Boolean(req.body.completed);

    if (!Number.isFinite(watchedSeconds) || watchedSeconds < 0) {
      return res.status(400).json({ error: "watchedSeconds must be a non-negative number." });
    }

    const normalizedWatchSeconds = Math.min(watchedSeconds, 3600);
    const increment = {
      totalWatchTimeSeconds: normalizedWatchSeconds
    };

    if (completed) {
      increment.completedViews = 1;
    }

    const video = await Video.findOneAndUpdate(
      { videoId: req.params.videoId },
      { $inc: increment },
      { returnDocument: "after" }
    );

    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    const averageWatchTimeSeconds =
      video.views > 0 ? Number((video.totalWatchTimeSeconds / video.views).toFixed(2)) : 0;

    if (video.averageWatchTimeSeconds !== averageWatchTimeSeconds) {
      video.averageWatchTimeSeconds = averageWatchTimeSeconds;
      await video.save();
    }

    res.json({
      video: mapVideoResponse(req, video)
    });
  } catch (error) {
    console.error("Watch analytics update failed:", error.message);
    res.status(500).json({ error: "Unable to update watch analytics." });
  }
});

router.post("/:videoId/like", async (req, res) => {
  try {
    await ensureBundledSampleVideos();
    const video = await Video.findOneAndUpdate(
      { videoId: req.params.videoId },
      { $inc: { likes: 1 } },
      { returnDocument: "after" }
    );

    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    res.json({
      video: mapVideoResponse(req, video)
    });
  } catch (error) {
    console.error("Like update failed:", error.message);
    res.status(500).json({ error: "Unable to update likes." });
  }
});

router.post("/:videoId/unlike", async (req, res) => {
  try {
    await ensureBundledSampleVideos();
    const existingVideo = await Video.findOne({ videoId: req.params.videoId });

    if (!existingVideo) {
      return res.status(404).json({ error: "Video not found." });
    }

    if ((existingVideo.likes || 0) <= 0) {
      return res.json({
        video: mapVideoResponse(req, existingVideo)
      });
    }

    const video = await Video.findOneAndUpdate(
      { videoId: req.params.videoId },
      { $inc: { likes: -1 } },
      { returnDocument: "after" }
    );

    res.json({
      video: mapVideoResponse(req, video)
    });
  } catch (error) {
    console.error("Unlike update failed:", error.message);
    res.status(500).json({ error: "Unable to update likes." });
  }
});

router.post("/:videoId/comments", async (req, res) => {
  try {
    await ensureBundledSampleVideos();
    const authorName = req.body.authorName?.trim() || "Anonymous";
    const text = req.body.text?.trim();

    if (!text) {
      return res.status(400).json({ error: "Comment text is required." });
    }

    const video = await Video.findOneAndUpdate(
      { videoId: req.params.videoId },
      {
        $push: {
          comments: {
            authorName,
            text
          }
        },
        $inc: { commentsCount: 1 }
      },
      { returnDocument: "after" }
    );

    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    res.json({
      video: mapVideoResponse(req, video, { includeComments: true })
    });
  } catch (error) {
    console.error("Comment create failed:", error.message);
    res.status(500).json({ error: "Unable to add comment." });
  }
});

router.get("/:videoId", async (req, res) => {
  try {
    await ensureBundledSampleVideos();
    const video = await Video.findOne({ videoId: req.params.videoId }).lean();

    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    res.json({
      video: mapVideoResponse(req, video, { includeComments: true })
    });
  } catch (error) {
    console.error("Video fetch failed:", error.message);
    res.status(500).json({ error: "Unable to fetch video." });
  }
});

module.exports = router;
