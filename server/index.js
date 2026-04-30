const express = require("express");
const path = require("path");
const cors = require("cors");
const ffmpeg = require("fluent-ffmpeg");
const connectDB = require("./config/db");
const videoRoutes = require("./routes/videoRoutes");

const app = express();

const ffmpegBinPath = "C:\\ffmpeg\\ffmpeg-8.1-essentials_build\\bin";
ffmpeg.setFfmpegPath(`${ffmpegBinPath}\\ffmpeg.exe`);
ffmpeg.setFfprobePath(`${ffmpegBinPath}\\ffprobe.exe`);

app.use(cors());
app.use(express.json());
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
app.use("/api/videos", videoRoutes);

app.get("/test", (req, res) => {
  res.send("API working");
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});

const PORT = 5000;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
