"use client";

import { useRef, useState, useEffect } from "react";

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
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastXRef = useRef(0);
  const lastYRef = useRef(0);
  const undoStack = useRef<string[]>([]);
  const recordCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Handle video file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
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
    if (!videoRef.current || !canvasRef.current) return;

    const resizeCanvas = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas) {
        // Use getBoundingClientRect to get actual display dimensions
        const rect = video.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
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
  }, [videoSrc]);

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

    recordCanvas.width = canvasRef.current.width;
    recordCanvas.height = canvasRef.current.height;

    const ctx = recordCanvas.getContext("2d");
    if (!ctx) return;

    const stream = recordCanvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setRecordingUrl(url);
      // auto download
      const a = document.createElement("a");
      a.href = url;
      a.download = "recording.webm";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    recorder.start();
    setIsRecording(true);

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
        ctx.drawImage(canvasRef.current, 0, 0);
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

  // Handle keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying]);

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

  return (
    <div className="w-full min-h-screen bg-black flex items-center justify-center">
      {/* Upload Section */}
      {!videoSrc && (
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
          </div>
        </div>
      )}

      {/* Video Player - Fullscreen */}
      {videoSrc && (
        <div
          ref={containerRef}
          className="w-full h-screen relative bg-black group"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            if (isPlaying) setShowControls(false);
          }}
        >
          {/* Video Element */}
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full h-full object-contain cursor-pointer"
            onClick={togglePlayPause}
            crossOrigin="anonymous"
          />

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
          <canvas ref={recordCanvasRef} className="hidden" />

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
            <div className="bg-gradient-to-b from-black/60 to-transparent p-6 flex justify-center gap-4">
              <button
                onClick={() => setDrawingEnabled(!drawingEnabled)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  drawingEnabled
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-gray-600 text-white hover:bg-gray-700"
                }`}
              >
                {drawingEnabled ? "✏️ Drawing ON" : "✏️ Drawing OFF"}
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
            </div>
          </div>

          {/* Bottom Controls */}
          <div
            className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 z-20 ${
              showControls ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <div className="bg-gradient-to-t from-black/80 to-transparent p-6 space-y-4">
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
                      videoRef.current.currentTime = parseFloat(e.target.value);
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
              <div className="flex gap-4 items-center justify-center">
                {/* Skip Back 5s */}
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
                  ⬅ -5s
                </button>

                {/* Skip Back 1s */}
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = Math.max(
                        videoRef.current.currentTime - 1,
                        0,
                      );
                    }
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 transition text-base"
                >
                  ⬅ -1s
                </button>

                {/* Play/Pause */}
                <button
                  onClick={togglePlayPause}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition text-base"
                >
                  {isPlaying ? "⏸ Pause" : "▶ Play"}
                </button>

                {/* Skip Forward 1s */}
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = Math.min(
                        videoRef.current.currentTime + 1,
                        videoRef.current.duration || 0,
                      );
                    }
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 transition text-base"
                >
                  +1s ➡
                </button>

                {/* Skip Forward 5s */}
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
                  +5s ➡
                </button>

                {/* Record 10s clip */}
                <button
                  onClick={startRecording}
                  disabled={isRecording}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition text-sm disabled:opacity-50"
                >
                  {isRecording ? "🔴 Recording..." : "🔴 Record 10s"}
                </button>
              </div>
            </div>
          </div>

          {recordingUrl && (
            <div className="absolute bottom-20 left-0 right-0 flex justify-center z-20">
              <a
                href={recordingUrl}
                download="recording.webm"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                💾 Download clip
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
