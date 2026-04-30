const express = require("express");
const path = require("path");
const cors = require("cors");
const ffmpeg = require("fluent-ffmpeg");
const connectDB = require("./config/db");
const videoRoutes = require("./routes/videoRoutes");

const app = express();

/* 🔥 FIX 1: FFmpeg for production (Render uses Linux) */
if (process.env.NODE_ENV === "production") {
  ffmpeg.setFfmpegPath("/usr/bin/ffmpeg");
  ffmpeg.setFfprobePath("/usr/bin/ffprobe");
} else {
  const ffmpegBinPath = "C:\\ffmpeg\\ffmpeg-8.1-essentials_build\\bin";
  ffmpeg.setFfmpegPath(`${ffmpegBinPath}\\ffmpeg.exe`);
  ffmpeg.setFfprobePath(`${ffmpegBinPath}\\ffprobe.exe`);
}

/* 🔥 FIX 2: Middleware */
app.use(cors());
app.use(express.json());

/* 🔥 Static folders */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(
  "/videos",
  express.static(path.join(__dirname, "transcoded"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".m3u8")) {
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      }
      if (filePath.endsWith(".ts")) {
        res.setHeader("Content-Type", "video/mp2t");
      }
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
  })
);

app.use("/client", express.static(path.join(__dirname, "..", "client")));

/* 🔥 API routes */
app.use("/api/videos", videoRoutes);

/* 🔥 Test route */
app.get("/test", (req, res) => {
  res.send("API working");
});

/* 🔥 Home route */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});

/* 🔥 FIX 3: IMPORTANT FOR RENDER */
const PORT = process.env.PORT || 5000;

/* 🔥 Start server */
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server failed:", error);
  }
};

startServer();