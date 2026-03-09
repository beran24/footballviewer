"use client";

import { useRef, useState, useEffect } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const RECORDING_FORMATS = [
  "video/mp4;codecs=h264,aac",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm",
] as const;

const FFMPEG_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
const MAX_RECORDING_WIDTH = 854;
const TARGET_FPS = 24;
const TARGET_VIDEO_BITRATE = "900k";
const TARGET_MAXRATE = "1200k";
const TARGET_BUFSIZE = "2400k";

export default function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [lineColor, setLineColor] = useState("#FF0000");
  const [lineWidth, setLineWidth] = useState(3);
  const [arrowStart, setArrowStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [isArrowMode, setIsArrowMode] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [recordingMessage, setRecordingMessage] = useState<string | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingFilename, setRecordingFilename] = useState("recording.mp4");
  const [exportFormat, setExportFormat] = useState<"mp4" | "avi">("mp4");
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSpeedSubmenu, setShowSpeedSubmenu] = useState(false);
  const [volume, setVolume] = useState(1); // 0-1 volume level
  const [youtubeInput, setYoutubeInput] = useState("");
  const [youtubeEmbedUrl, setYoutubeEmbedUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastXRef = useRef(0);
  const lastYRef = useRef(0);
  const undoStack = useRef<string[]>([]);
  const recordCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const extractYouTubeVideoId = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return null;

    // Allow direct video id input (11 chars).
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }

    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

      if (host === "youtu.be") {
        const id = parsed.pathname.split("/").filter(Boolean)[0];
        return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }

      if (host === "youtube.com" || host === "m.youtube.com") {
        const watchId = parsed.searchParams.get("v");
        if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) return watchId;

        const segments = parsed.pathname.split("/").filter(Boolean);
        const markerIndex = segments.findIndex(
          (segment) => segment === "embed" || segment === "shorts",
        );
        if (markerIndex >= 0) {
          const id = segments[markerIndex + 1];
          return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
        }
      }
    } catch {
      return null;
    }

    return null;
  };

  const handleYouTubeLoad = () => {
    const videoId = extractYouTubeVideoId(youtubeInput);
    if (!videoId) {
      setUploadError("Link de YouTube no valido. Pega una URL correcta.");
      return;
    }

    setUploadError(null);
    setVideoSrc("");
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setYoutubeEmbedUrl(`https://www.youtube.com/embed/${videoId}?autoplay=1`);

    // Reset drawing state to avoid stale UI when switching sources.
    setDrawingEnabled(false);
    undoStack.current = [];
    setUndoCount(0);
    setTimeout(() => {
      clearCanvas();
    }, 100);
  };

  const loadFfmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: await toBlobURL(
        `${FFMPEG_BASE_URL}/ffmpeg-core.js`,
        "text/javascript",
      ),
      wasmURL: await toBlobURL(
        `${FFMPEG_BASE_URL}/ffmpeg-core.wasm`,
        "application/wasm",
      ),
      workerURL: await toBlobURL(
        `${FFMPEG_BASE_URL}/ffmpeg-core.worker.js`,
        "text/javascript",
      ),
    });
    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  };

  const convertToVideo = async (sourceBlob: Blob, format: "mp4" | "avi") => {
    const ffmpeg = await loadFfmpeg();
    const inputFile = "input.bin";
    const outputFile = `output.${format}`;

    await ffmpeg.writeFile(inputFile, await fetchFile(sourceBlob));
    const baseArgs = [
      "-i",
      inputFile,
      "-r",
      String(TARGET_FPS),
      "-c:v",
      "mpeg4",
      "-b:v",
      TARGET_VIDEO_BITRATE,
      "-maxrate",
      TARGET_MAXRATE,
      "-bufsize",
      TARGET_BUFSIZE,
      "-pix_fmt",
      "yuv420p",
    ];
    const command =
      format === "mp4"
        ? [...baseArgs, "-movflags", "+faststart", outputFile]
        : [...baseArgs, outputFile];
    await ffmpeg.exec(command);

    const outputData = await ffmpeg.readFile(outputFile);
    await ffmpeg.deleteFile(inputFile);
    await ffmpeg.deleteFile(outputFile);
    const sourceBytes = outputData as Uint8Array;
    const safeBytes = new Uint8Array(sourceBytes.byteLength);
    safeBytes.set(sourceBytes);
    return new Blob([safeBytes], {
      type: format === "mp4" ? "video/mp4" : "video/x-msvideo",
    });
  };

  // Handle video file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      setYoutubeEmbedUrl(null);
      setUploadError(null);
      setVideoSrc(url);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setPlaybackSpeed(1);
      // Reset undo stack and clear canvas when new video is loaded
      undoStack.current = [];
      setUndoCount(0);
      setTimeout(() => {
        clearCanvas();
      }, 100);
    }
  };

  // Initialize canvas when video is loaded
  useEffect(() => {
    if (!canvasRef.current) return;

    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const container = containerRef.current;
      if (!canvas) return;

      // For local files, match the rendered <video>. For YouTube iframe, match container.
      const rect =
        video?.getBoundingClientRect() || container?.getBoundingClientRect();
      if (!rect) return;
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    // Resize on load and after a small delay
    resizeCanvas();
    // also keep recording canvas in sync
    if (recordCanvasRef.current) {
      recordCanvasRef.current.width = canvasRef.current?.width || 0;
      recordCanvasRef.current.height = canvasRef.current?.height || 0;
    }
    const timeoutId = setTimeout(() => {
      resizeCanvas();
      if (recordCanvasRef.current) {
        recordCanvasRef.current.width = canvasRef.current?.width || 0;
        recordCanvasRef.current.height = canvasRef.current?.height || 0;
      }
    }, 100);
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      clearTimeout(timeoutId);
    };
  }, [videoSrc, youtubeEmbedUrl]);

  // Save current canvas state for undo
  const pushUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    undoStack.current.push(canvas.toDataURL());
    if (undoStack.current.length > 50) {
      undoStack.current.shift();
    }
    setUndoCount(undoStack.current.length);
  };

  // Draw line on canvas
  const drawLine = (fromX: number, fromY: number, toX: number, toY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
  };

  // Draw arrow from start to end
  const drawArrow = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ) => {
    drawLine(fromX, fromY, toX, toY);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const headlen = 10;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headlen * Math.cos(angle - Math.PI / 6),
      toY - headlen * Math.sin(angle - Math.PI / 6),
    );
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headlen * Math.cos(angle + Math.PI / 6),
      toY - headlen * Math.sin(angle + Math.PI / 6),
    );
    ctx.stroke();
  };

  // Handle mouse down
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingEnabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // push current state for undo before any modification
    pushUndo();

    if (e.ctrlKey) {
      // start arrow mode
      setArrowStart({ x, y });
      setIsArrowMode(true);
      setIsDrawing(false);
    } else {
      setIsDrawing(true);
      setArrowStart(null);
      setIsArrowMode(false);
      lastXRef.current = x;
      lastYRef.current = y;
    }
  };

  // Handle mouse move
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    if (!drawingEnabled) return;

    if (isArrowMode && arrowStart) {
      // show preview by redrawing canvas? for simplicity ignore preview
    } else if (isDrawing) {
      drawLine(lastXRef.current, lastYRef.current, currentX, currentY);
      lastXRef.current = currentX;
      lastYRef.current = currentY;
    }
  };

  // Handle mouse up
  const handleCanvasMouseUp = (e?: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setIsDrawing(false);
      setIsArrowMode(false);
      setArrowStart(null);
      return;
    }
    if (isArrowMode && arrowStart && e) {
      const rect = canvas.getBoundingClientRect();
      const endX = e.clientX - rect.left;
      const endY = e.clientY - rect.top;
      drawArrow(arrowStart.x, arrowStart.y, endX, endY);
    }
    setIsDrawing(false);
    setIsArrowMode(false);
    setArrowStart(null);
  };

  // Clear canvas (push current state for undo)
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      // save state so Delete can be undone via Backspace
      undoStack.current.push(canvas.toDataURL());
      if (undoStack.current.length > 50) undoStack.current.shift();
      setUndoCount(undoStack.current.length);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Handle play/pause
  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  // Show controls on mouse move
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  // Recording logic
  const startRecording = () => {
    if (!videoRef.current || !canvasRef.current || isRecording) return;
    const recordCanvas = recordCanvasRef.current;
    if (!recordCanvas) return;

    const sourceWidth = canvasRef.current.width;
    const sourceHeight = canvasRef.current.height;
    const scaleFactor =
      sourceWidth > MAX_RECORDING_WIDTH ? MAX_RECORDING_WIDTH / sourceWidth : 1;
    const scaledWidth = Math.max(
      2,
      Math.floor((sourceWidth * scaleFactor) / 2) * 2,
    );
    const scaledHeight = Math.max(
      2,
      Math.floor((sourceHeight * scaleFactor) / 2) * 2,
    );
    recordCanvas.width = scaledWidth;
    recordCanvas.height = scaledHeight;

    const ctx = recordCanvas.getContext("2d");
    if (!ctx) return;

    const stream = recordCanvas.captureStream(TARGET_FPS);
    const supportedMimeType = RECORDING_FORMATS.find((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType),
    );
    const recorder = supportedMimeType
      ? new MediaRecorder(stream, { mimeType: supportedMimeType })
      : new MediaRecorder(stream);
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      let finalBlob = new Blob(chunks, {
        type: supportedMimeType || recorder.mimeType || "video/webm",
      });
      let finalFilename = "recording.webm";

      try {
        setIsConverting(true);
        const targetLabel = exportFormat.toUpperCase();
        setRecordingMessage(`Comprimiendo y convirtiendo a ${targetLabel}...`);
        finalBlob = await convertToVideo(finalBlob, exportFormat);
        finalFilename = `recording.${exportFormat}`;
        setRecordingMessage(`${targetLabel} comprimido listo para descargar.`);
      } catch (targetError) {
        console.error(`Error converting to ${exportFormat}`, targetError);
        const fallbackFormat = exportFormat === "mp4" ? "avi" : "mp4";
        try {
          setRecordingMessage(
            `${exportFormat.toUpperCase()} fallo. Convirtiendo a ${fallbackFormat.toUpperCase()}...`,
          );
          finalBlob = await convertToVideo(finalBlob, fallbackFormat);
          finalFilename = `recording.${fallbackFormat}`;
          setRecordingMessage(
            `${fallbackFormat.toUpperCase()} comprimido listo para descargar.`,
          );
        } catch (fallbackError) {
          console.error(`Error converting to ${fallbackFormat}`, fallbackError);
          setRecordingMessage("No se pudo convertir. Se descarga en WEBM.");
        }
      } finally {
        setIsConverting(false);
      }

      const url = URL.createObjectURL(finalBlob);
      setRecordingUrl(url);
      setRecordingFilename(finalFilename);
      // auto download
      const a = document.createElement("a");
      a.href = url;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    recorder.start();
    setIsRecording(true);

    // Start playing when recording starts
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }

    let frameId: number;
    const drawFrame = () => {
      if (ctx && videoRef.current && canvasRef.current) {
        ctx.drawImage(
          videoRef.current,
          0,
          0,
          recordCanvas.width,
          recordCanvas.height,
        );
        // Scale drawing overlay to the same output size as the recorded frame.
        ctx.drawImage(
          canvasRef.current,
          0,
          0,
          recordCanvas.width,
          recordCanvas.height,
        );
      }
      frameId = requestAnimationFrame(drawFrame);
    };
    drawFrame();

    setTimeout(() => {
      recorder.stop();
      cancelAnimationFrame(frameId);
      setIsRecording(false);
    }, 10000);
  };

  // Handle playback speed change
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  // Handle click outside settings menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        settingsMenuRef.current &&
        !settingsMenuRef.current.contains(e.target as Node)
      ) {
        setShowSettingsMenu(false);
        setShowSpeedSubmenu(false);
      }
    };
    if (showSettingsMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSettingsMenu]);

  // Handle keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        // Use Tab as a quick drawing toggle while the player is open.
        if (videoSrc || youtubeEmbedUrl) {
          e.preventDefault();
          if (!e.repeat) {
            setDrawingEnabled((prev) => !prev);
            setShowControls(true);
          }
        }
        return;
      }

      if (e.key === "Delete") {
        e.preventDefault();
        clearCanvas();
        return;
      }

      if (!videoRef.current) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (e.ctrlKey) {
          // Control + Right: +5 seconds
          videoRef.current.currentTime = Math.min(
            videoRef.current.currentTime + 5,
            videoRef.current.duration || 0,
          );
        } else {
          // Right: +1 second
          videoRef.current.currentTime = Math.min(
            videoRef.current.currentTime + 1,
            videoRef.current.duration || 0,
          );
        }
        setShowControls(true);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (e.ctrlKey) {
          // Control + Left: -5 seconds
          videoRef.current.currentTime = Math.max(
            videoRef.current.currentTime - 5,
            0,
          );
        } else {
          // Left: -1 second
          videoRef.current.currentTime = Math.max(
            videoRef.current.currentTime - 1,
            0,
          );
        }
        setShowControls(true);
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlayPause();
        setShowControls(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPlaying, videoSrc, youtubeEmbedUrl]);

  // Undo helper (pops last state and draws it)
  const handleUndo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx && undoStack.current.length) {
      const data = undoStack.current.pop();
      if (data) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = data;
      }
      setUndoCount(undoStack.current.length);
    }
  };

  // Handle global undo key (Backspace)
  useEffect(() => {
    const undoKey = (e: KeyboardEvent) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", undoKey);
    return () => window.removeEventListener("keydown", undoKey);
  }, []);

  // Update current time display and duration when video element changes (e.g. new source)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => {
      setCurrentTime(video.currentTime);
    };

    const updateDuration = () => {
      if (video.duration && !isNaN(video.duration)) {
        setDuration(video.duration);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener("timeupdate", updateTime);
    video.addEventListener("loadedmetadata", updateDuration);
    video.addEventListener("loadeddata", updateDuration);
    video.addEventListener("canplay", updateDuration);
    video.addEventListener("durationchange", updateDuration);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    // Force duration check after a delay
    const checkDurationTimeout = setTimeout(() => {
      updateDuration();
    }, 500);

    return () => {
      video.removeEventListener("timeupdate", updateTime);
      video.removeEventListener("loadedmetadata", updateDuration);
      video.removeEventListener("loadeddata", updateDuration);
      video.removeEventListener("canplay", updateDuration);
      video.removeEventListener("durationchange", updateDuration);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      clearTimeout(checkDurationTimeout);
    };
  }, [videoSrc]);

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "0:00:00";
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // clear download link after 10 seconds
  useEffect(() => {
    if (!recordingUrl) return;
    const timer = setTimeout(() => {
      setRecordingUrl(null);
    }, 10000);
    return () => clearTimeout(timer);
  }, [recordingUrl]);

  return (
    <div className="w-full min-h-screen bg-black flex items-center justify-center">
      {/* Upload Section */}
      {!videoSrc && !youtubeEmbedUrl && (
        <div className="w-full max-w-2xl mx-auto p-6">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">
              Video Player
            </h1>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload MP4 Video
              </label>
              <input
                type="file"
                accept="video/mp4"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
            </div>

            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
              <p className="text-lg">Upload a video file to get started</p>
            </div>

            <div className="mt-6 border-t border-gray-200 pt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                O pega un link de YouTube
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={youtubeInput}
                  onChange={(e) => setYoutubeInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleYouTubeLoad}
                  className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-semibold hover:bg-red-700 transition"
                >
                  Cargar
                </button>
              </div>
              {uploadError && (
                <p className="mt-2 text-sm text-red-600">{uploadError}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video Player - Fullscreen */}
      {(videoSrc || youtubeEmbedUrl) && (
        <div
          ref={containerRef}
          className="w-full h-screen relative bg-black group"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            if (isPlaying) setShowControls(false);
          }}
        >
          {/* Video Element */}
          {videoSrc ? (
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full h-full object-contain cursor-pointer"
              onClick={togglePlayPause}
              crossOrigin="anonymous"
            />
          ) : (
            <iframe
              src={youtubeEmbedUrl || ""}
              className="w-full h-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              title="YouTube player"
            />
          )}

          {/* Drawing Canvas */}
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 cursor-crosshair z-10 ${
              drawingEnabled ? "" : "pointer-events-none"
            }`}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            style={{ top: 0, left: 0 }}
          />
          {/* Hidden canvas used for recording video + annotations */}
          {videoSrc && <canvas ref={recordCanvasRef} className="hidden" />}

          {/* Top Controls */}
          <div
            className={`absolute top-0 left-0 right-0 transition-opacity duration-300 z-20 ${
              showControls
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none"
            }`}
          >
            <div className="absolute top-3 right-3">
              <button
                onClick={() => {
                  setVideoSrc("");
                  setYoutubeEmbedUrl(null);
                  setYoutubeInput("");
                  setCurrentTime(0);
                  setDuration(0);
                  clearCanvas();
                  undoStack.current = [];
                  setUndoCount(0);
                }}
                className="text-white bg-black/50 hover:bg-black/70 rounded-full w-8 h-8 flex items-center justify-center"
                title="Close video"
              >
                ✕
              </button>
            </div>
            <div className="bg-gradient-to-b from-black/60 to-transparent p-6 flex justify-center gap-4 flex-wrap">
              <button
                onClick={() => setDrawingEnabled(!drawingEnabled)}
                title="Toggle drawing (Tab)"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  drawingEnabled
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-gray-600 text-white hover:bg-gray-700"
                }`}
              >
                {drawingEnabled
                  ? "✏️ Drawing ON (Tab)"
                  : "✏️ Drawing OFF (Tab)"}
              </button>

              {drawingEnabled && (
                <>
                  <input
                    type="color"
                    value={lineColor}
                    onChange={(e) => setLineColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer border-2 border-white"
                    title="Draw Color"
                  />

                  <select
                    value={lineWidth}
                    onChange={(e) => setLineWidth(Number(e.target.value))}
                    className="px-4 py-2 rounded-lg font-medium bg-gray-600 text-white hover:bg-gray-700"
                  >
                    <option value={3}>Size: 3px</option>
                    <option value={5}>Size: 5px</option>
                    <option value={8}>Size: 8px</option>
                  </select>

                  <button
                    onClick={clearCanvas}
                    className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 transition"
                  >
                    🗑️ Clear
                  </button>

                  <button
                    onClick={handleUndo}
                    disabled={undoCount === 0}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
                    title="Undo last action (Backspace)"
                  >
                    ↩️ Undo{undoCount > 0 ? ` (${undoCount})` : ""}
                  </button>
                </>
              )}

              {!videoSrc && (
                <div className="text-white text-sm self-center">
                  Modo YouTube: puedes dibujar encima, pero no grabar/exportar.
                </div>
              )}
            </div>
          </div>

          {/* Bottom Controls */}
          {videoSrc && (
            <div
              className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 z-20 ${
                showControls ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <div className="bg-gradient-to-t from-black/80 to-transparent p-6 space-y-4 relative">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max={videoRef.current?.duration || 0}
                    value={currentTime}
                    step="0.1"
                    onChange={(e) => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = parseFloat(
                          e.target.value,
                        );
                        setCurrentTime(parseFloat(e.target.value));
                      }
                    }}
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${videoRef.current?.duration ? (currentTime / videoRef.current.duration) * 100 : 0}%, #64748b ${videoRef.current?.duration ? (currentTime / videoRef.current.duration) * 100 : 0}%, #64748b 100%)`,
                    }}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:h-3 transition-all"
                  />
                  <div className="flex justify-between text-sm text-white">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(videoRef.current?.duration || 0)}</span>
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="flex justify-between items-center relative">
                  {/* Volume on left */}
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm">🔊</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setVolume(v);
                        if (videoRef.current) {
                          videoRef.current.volume = v;
                        }
                      }}
                      className="volume-slider w-32 h-1 appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 ${volume * 100}%, #64748b ${volume * 100}%)`,
                      }}
                    />
                  </div>

                  {/* Center controls group */}
                  <div className="flex gap-4 items-center">
                    <select
                      value={exportFormat}
                      onChange={(e) =>
                        setExportFormat(e.target.value as "mp4" | "avi")
                      }
                      disabled={isRecording || isConverting}
                      className="px-3 py-2 bg-gray-700 text-white rounded-lg font-bold hover:bg-gray-600 transition text-sm disabled:opacity-50"
                      title="Formato de descarga"
                    >
                      <option value="mp4">MP4</option>
                      <option value="avi">AVI</option>
                    </select>

                    <button
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.currentTime = Math.max(
                            videoRef.current.currentTime - 5,
                            0,
                          );
                        }
                      }}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg font-bold hover:bg-gray-800 transition text-sm"
                    >
                      &lt;&lt;
                    </button>

                    <button
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.currentTime = Math.max(
                            videoRef.current.currentTime - 1,
                            0,
                          );
                        }
                      }}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg font-bold hover:bg-gray-800 transition text-sm"
                    >
                      &lt;
                    </button>

                    <button
                      onClick={togglePlayPause}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition text-sm"
                    >
                      {isPlaying ? "⏸ Pause" : "▶ Play"}
                    </button>

                    <button
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.currentTime = Math.min(
                            videoRef.current.currentTime + 1,
                            videoRef.current.duration || 0,
                          );
                        }
                      }}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg font-bold hover:bg-gray-800 transition text-sm"
                    >
                      &gt;
                    </button>

                    <button
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.currentTime = Math.min(
                            videoRef.current.currentTime + 5,
                            videoRef.current.duration || 0,
                          );
                        }
                      }}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg font-bold hover:bg-gray-800 transition text-sm"
                    >
                      &gt;&gt;
                    </button>

                    <button
                      onClick={startRecording}
                      disabled={isRecording || isConverting}
                      className={`px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition text-sm ${
                        isRecording ? "animate-pulse" : ""
                      } disabled:opacity-50`}
                    >
                      {isConverting ? "⏳" : "🔴"}
                    </button>
                  </div>

                  {/* Gear on right */}
                  <div ref={settingsMenuRef} className="relative">
                    <button
                      onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg font-bold hover:bg-gray-600 transition text-sm"
                      title="Settings"
                    >
                      ⚙️
                    </button>
                    {showSettingsMenu && (
                      <div className="absolute bottom-full right-0 mb-1 bg-gray-800 rounded-lg shadow-lg border border-gray-700 min-w-max">
                        {/* Speed Option */}
                        <div className="relative">
                          <button
                            onClick={() =>
                              setShowSpeedSubmenu(!showSpeedSubmenu)
                            }
                            className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition flex items-center justify-between"
                          >
                            <span>Speed</span>
                            <span className="ml-2">▶</span>
                          </button>
                          {/* Speed Submenu Items */}
                          {showSpeedSubmenu && (
                            <div className="absolute right-full top-1/2 -translate-y-1/2 bg-gray-800 rounded-lg shadow-lg border border-gray-700 flex flex-col mr-1">
                              {[0.25, 0.5, 0.75, 1, 1.5, 2].map((speed) => (
                                <button
                                  key={speed}
                                  onClick={() => {
                                    handleSpeedChange(speed);
                                    setShowSettingsMenu(false);
                                    setShowSpeedSubmenu(false);
                                  }}
                                  className={`px-3 py-1 text-xs transition ${
                                    playbackSpeed === speed
                                      ? "bg-blue-600 text-white"
                                      : "text-gray-200 hover:bg-gray-700"
                                  } ${speed === 0.25 ? "rounded-tl-lg" : ""} ${
                                    speed === 2 ? "rounded-bl-lg" : ""
                                  }`}
                                >
                                  {speed}x
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {videoSrc && recordingUrl && (
            <div className="absolute bottom-20 left-0 right-0 flex justify-center z-20">
              <a
                href={recordingUrl}
                download={recordingFilename}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                💾 Download clip
              </a>
            </div>
          )}
          {videoSrc && recordingMessage && (
            <div className="absolute bottom-32 left-0 right-0 flex justify-center z-20">
              <div className="px-3 py-1.5 bg-black/70 text-white text-sm rounded-md">
                {recordingMessage}
              </div>
            </div>
          )}
          {/* custom slider thumb sizing */}
          <style jsx>{`
            .volume-slider::-webkit-slider-thumb {
              width: 8px;
              height: 8px;
              background: #fff;
              border: 1px solid #3b82f6;
              border-radius: 50%;
              cursor: pointer;
              margin-top: -3px; /* center thumb on track */
            }
            .volume-slider::-moz-range-thumb {
              width: 8px;
              height: 8px;
              background: #fff;
              border: 1px solid #3b82f6;
              border-radius: 50%;
              cursor: pointer;
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
