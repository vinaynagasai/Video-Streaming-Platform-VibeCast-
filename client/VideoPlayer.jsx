import React, { useEffect, useRef, useState } from "react";

const HLS_MIME_TYPE = "application/vnd.apple.mpegurl";

const VideoPlayer = ({
  src,
  videoId,
  apiBaseUrl = "http://localhost:5000",
  poster,
  autoPlay = false
}) => {
  const videoRef = useRef(null);
  const [streamUrl, setStreamUrl] = useState(src || "");
  const [error, setError] = useState("");

  useEffect(() => {
    setStreamUrl(src || "");
    setError("");
  }, [src]);

  useEffect(() => {
    if (src || !videoId) {
      return undefined;
    }

    let isActive = true;

    const loadStream = async () => {
      try {
        setError("");
        const response = await fetch(`${apiBaseUrl}/api/videos/${videoId}/stream`);
        let data = null;

        try {
          data = await response.json();
        } catch (parseError) {
          data = null;
        }

        if (!response.ok) {
          throw new Error(data?.error || "Unable to load stream metadata.");
        }

        if (isActive) {
          setStreamUrl(data.streamUrl);
        }
      } catch (fetchError) {
        if (isActive) {
          setError(fetchError.message);
        }
      }
    };

    loadStream();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl, src, videoId]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !streamUrl) {
      return undefined;
    }

    if (video.canPlayType(HLS_MIME_TYPE)) {
      video.src = streamUrl;
      return undefined;
    }

    const Hls = window.Hls;

    if (!Hls || !Hls.isSupported()) {
      console.error("HLS.js is not available and this browser does not support native HLS.");
      return undefined;
    }

    const hls = new Hls({
      enableWorker: true
    });

    hls.loadSource(streamUrl);
    hls.attachMedia(video);

    return () => {
      hls.destroy();
    };
  }, [streamUrl]);

  return (
    <div>
      {error ? (
        <p style={{ color: "#dc2626", marginBottom: "12px" }}>{error}</p>
      ) : null}
      <video
        ref={videoRef}
        controls
        autoPlay={autoPlay}
        poster={poster}
        style={{ width: "100%", maxWidth: "960px" }}
      >
        <source src={streamUrl} type={HLS_MIME_TYPE} />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default VideoPlayer;
