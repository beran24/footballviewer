import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import type { Point } from "../types";

type SurfaceSize = {
  width: number;
  height: number;
};

type UseCanvasDrawingParams = {
  drawingSurfaceRef: RefObject<HTMLDivElement | null>;
};

export type UseCanvasDrawingResult = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  surfaceSize: SurfaceSize;
  isDrawEnabled: boolean;
  setIsDrawEnabled: Dispatch<SetStateAction<boolean>>;
  strokeColor: string;
  setStrokeColor: Dispatch<SetStateAction<string>>;
  lineWidth: number;
  setLineWidth: Dispatch<SetStateAction<number>>;
  hasDrawing: boolean;
  clearCanvas: () => void;
  handlePointerDown: (event: PointerEvent<HTMLCanvasElement>) => void;
  handlePointerMove: (event: PointerEvent<HTMLCanvasElement>) => void;
  finishDrawing: (event: PointerEvent<HTMLCanvasElement>) => void;
};

export function useCanvasDrawing({
  drawingSurfaceRef,
}: UseCanvasDrawingParams): UseCanvasDrawingResult {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const previousPointRef = useRef<Point | null>(null);

  const [strokeColor, setStrokeColor] = useState("#ffffff");
  const [lineWidth, setLineWidth] = useState(4);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [isDrawEnabled, setIsDrawEnabled] = useState(false);
  const [surfaceSize, setSurfaceSize] = useState<SurfaceSize>({
    width: 0,
    height: 0,
  });

  const getCanvasPoint = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const drawingSurface = drawingSurfaceRef.current;
    if (!canvas || !drawingSurface) {
      return;
    }

    const nextWidth = Math.max(1, Math.floor(drawingSurface.clientWidth));
    const nextHeight = Math.max(1, Math.floor(drawingSurface.clientHeight));
    setSurfaceSize({ width: nextWidth, height: nextHeight });
    if (canvas.width === nextWidth && canvas.height === nextHeight) {
      return;
    }

    const snapshot = document.createElement("canvas");
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    const snapshotContext = snapshot.getContext("2d");
    if (snapshotContext) {
      snapshotContext.drawImage(canvas, 0, 0);
    }

    canvas.width = nextWidth;
    canvas.height = nextHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.lineCap = "round";
    context.lineJoin = "round";

    if (snapshot.width > 0 && snapshot.height > 0) {
      context.drawImage(snapshot, 0, 0, nextWidth, nextHeight);
    }
  }, [drawingSurfaceRef]);

  useEffect(() => {
    resizeCanvas();

    const observer = new ResizeObserver(() => {
      resizeCanvas();
    });

    if (drawingSurfaceRef.current) {
      observer.observe(drawingSurfaceRef.current);
    }

    window.addEventListener("resize", resizeCanvas);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [drawingSurfaceRef, resizeCanvas]);

  const drawSegment = useCallback(
    (from: Point, to: Point) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      context.strokeStyle = strokeColor;
      context.lineWidth = lineWidth;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    },
    [lineWidth, strokeColor],
  );

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawEnabled || event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    isDrawingRef.current = true;
    const point = getCanvasPoint(event);
    previousPointRef.current = point;

    drawSegment(point, { x: point.x + 0.01, y: point.y + 0.01 });
    setHasDrawing(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawEnabled || !isDrawingRef.current || !previousPointRef.current) {
      return;
    }

    const point = getCanvasPoint(event);
    drawSegment(previousPointRef.current, point);
    previousPointRef.current = point;
    setHasDrawing(true);
  };

  const finishDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    isDrawingRef.current = false;
    previousPointRef.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  };

  return {
    canvasRef,
    surfaceSize,
    isDrawEnabled,
    setIsDrawEnabled,
    strokeColor,
    setStrokeColor,
    lineWidth,
    setLineWidth,
    hasDrawing,
    clearCanvas,
    handlePointerDown,
    handlePointerMove,
    finishDrawing,
  };
}
