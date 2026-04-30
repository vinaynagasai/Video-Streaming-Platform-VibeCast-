const ffmpeg = require("fluent-ffmpeg");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("transcoder.js loaded");

const renditions = [
  {
    name: "720p",
    width: 1280,
    height: 720,
    videoBitrate: "2800k",
    maxRate: "2996k",
    bufferSize: "4200k",
    audioBitrate: "128k",
    bandwidth: 3228000
  },
  {
    name: "480p",
    width: 854,
    height: 480,
    videoBitrate: "1400k",
    maxRate: "1498k",
    bufferSize: "2100k",
    audioBitrate: "96k",
    bandwidth: 1645600
  }
];

const buildOutputDir = (videoId) => path.join(__dirname, "..", "transcoded", videoId);

const buildVariantArgs = ({ inputPath, outputDir, rendition, hasAudio }) => {
  const playlistPath = path.join(outputDir, `${rendition.name}.m3u8`).replace(/\\/g, "/");
  const segmentPattern = path.join(outputDir, `${rendition.name}_%03d.ts`).replace(/\\/g, "/");
  return [
    "-y",
    "-i",
    inputPath,
    "-map",
    "0:v:0",
    ...(hasAudio ? ["-map", "0:a:0?"] : []),
    "-preset",
    "veryfast",
    "-g",
    "48",
    "-sc_threshold",
    "0",
    "-c:v",
    "libx264",
    "-vf",
    `scale=w=${rendition.width}:h=${rendition.height}:force_original_aspect_ratio=decrease,pad=${rendition.width}:${rendition.height}:(ow-iw)/2:(oh-ih)/2`,
    "-b:v",
    rendition.videoBitrate,
    "-maxrate",
    rendition.maxRate,
    "-bufsize",
    rendition.bufferSize,
    ...(hasAudio
      ? [
          "-c:a",
          "aac",
          "-ar",
          "48000",
          "-b:a",
          rendition.audioBitrate
        ]
      : []),
    "-f",
    "hls",
    "-hls_time",
    "6",
    "-hls_playlist_type",
    "vod",
    "-hls_list_size",
    "0",
    "-hls_segment_filename",
    segmentPattern,
    playlistPath
  ];
};

const getFfmpegBinary = () =>
  new Promise((resolve, reject) => {
    ffmpeg()
      ._getFfmpegPath((error, ffmpegPath) => {
        if (error || !ffmpegPath) {
          reject(error || new Error("FFmpeg binary path was not configured."));
          return;
        }

        resolve(ffmpegPath);
      });
  });

const runFfmpegCommand = async (args) => {
  const ffmpegPath = await getFfmpegBinary();

  return new Promise((resolve, reject) => {
    const process = spawn(ffmpegPath, args, {
      windowsHide: true
    });
    let stderr = "";

    process.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    process.on("error", reject);
    process.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `FFmpeg exited with code ${code}.`));
    });
  });
};

const writeMasterPlaylist = (outputDir) => {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];

  for (const rendition of renditions) {
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${rendition.bandwidth},RESOLUTION=${rendition.width}x${rendition.height}`,
      `${rendition.name}.m3u8`
    );
  }

  fs.writeFileSync(path.join(outputDir, "master.m3u8"), `${lines.join("\n")}\n`, "utf8");
};

const generateThumbnail = async (inputPath, outputDir) => {
  const thumbnailFilename = "thumbnail.jpg";
  const thumbnailPath = path.join(outputDir, thumbnailFilename);

  await runFfmpegCommand([
    "-y",
    "-i",
    inputPath,
    "-ss",
    "00:00:01.000",
    "-frames:v",
    "1",
    "-vf",
    "scale=960:-1",
    thumbnailPath
  ]);

  return {
    thumbnailFilename,
    thumbnailPath
  };
};

const transcodeVideo = (inputPath, options = {}) => {
  return new Promise((resolve, reject) => {
    const videoId = options.videoId || Date.now().toString();
    const outputDir = buildOutputDir(videoId);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    ffmpeg.ffprobe(inputPath, async (probeError, metadata) => {
      if (probeError) {
        reject(probeError);
        return;
      }

      const hasAudio = metadata.streams?.some((stream) => stream.codec_type === "audio");

      try {
        for (const rendition of renditions) {
          const args = buildVariantArgs({
            inputPath,
            outputDir,
            rendition,
            hasAudio
          });

          await runFfmpegCommand(args);
        }

        writeMasterPlaylist(outputDir);
        const thumbnail = await generateThumbnail(inputPath, outputDir);
        console.log("Transcoding finished");
        resolve({
          videoId,
          outputDir,
          thumbnailFilename: thumbnail.thumbnailFilename,
          thumbnailPath: thumbnail.thumbnailPath
        });
      } catch (error) {
        console.error("FFmpeg error:", error.message);
        reject(error);
      }
    });
  });
};

transcodeVideo.buildOutputDir = buildOutputDir;

module.exports = transcodeVideo;
