<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html>
<head>
    <title>Video Embed</title>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <style>
        body {
            margin: 0;
            padding: 24px;
            font-family: Arial, sans-serif;
            background: #111827;
            color: #f9fafb;
        }

        .player-shell {
            max-width: 960px;
            margin: 0 auto;
        }

        video {
            width: 100%;
            background: #000;
            border-radius: 12px;
        }
    </style>
</head>
<body>
    <div class="player-shell">
        <h1>Embedded Video</h1>
        <video id="videoPlayer" controls>
            <source src="" type="application/vnd.apple.mpegurl">
            Your browser does not support the video tag.
        </video>
    </div>

    <script>
        const params = new URLSearchParams(window.location.search);
        const src = params.get("src");
        const video = document.getElementById("videoPlayer");

        if (!src) {
            document.body.insertAdjacentHTML("beforeend", "<p>Missing ?src=/videos/{videoId}/master.m3u8</p>");
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = src;
        } else if (window.Hls && window.Hls.isSupported()) {
            const hls = new window.Hls();
            hls.loadSource(src);
            hls.attachMedia(video);
        } else {
            document.body.insertAdjacentHTML("beforeend", "<p>HLS playback is not supported in this browser.</p>");
        }
    </script>
</body>
</html>
