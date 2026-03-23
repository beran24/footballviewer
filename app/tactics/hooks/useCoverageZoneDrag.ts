import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import { clamp } from "../constants";
import type {
  EditableCoverageZoneRect,
  RenderedDefenseCoverageZone,
} from "../utils/overlays";

export type ZoneHandleDirection = "top" | "bottom" | "left" | "right";

type UseCoverageZoneDragParams = {
  drawingSurfaceRef: RefObject<HTMLDivElement | null>;
  isDrawEnabled: boolean;
  lineOfScrimmageTop: number;
  renderedDefenseCoverageZones: RenderedDefenseCoverageZone[];
  selectedCoverageZoneId: string | null;
  setSelectedCoverageZoneId: Dispatch<SetStateAction<string | null>>;
  setCoverageZoneOverrides: Dispatch<
    SetStateAction<Record<string, EditableCoverageZoneRect>>
  >;
  minCoverageZoneHeightPercent: number;
  minCoverageZoneWidthPercent: number;
};

export type UseCoverageZoneDragResult = {
  handleCoverageZoneLabelClick: (
    zoneId: string,
  ) => (event: MouseEvent<HTMLSpanElement>) => void;
  handleCoverageZoneHandlePointerDown: (
    zoneId: string,
    handle: ZoneHandleDirection,
  ) => (event: PointerEvent<HTMLDivElement>) => void;
  handleCoverageZoneHandlePointerMove: (
    event: PointerEvent<HTMLDivElement>,
  ) => void;
  handleCoverageZoneHandlePointerUp: (
    event: PointerEvent<HTMLDivElement>,
  ) => void;
};

export function useCoverageZoneDrag({
  drawingSurfaceRef,
  isDrawEnabled,
  lineOfScrimmageTop,
  renderedDefenseCoverageZones,
  selectedCoverageZoneId,
  setSelectedCoverageZoneId,
  setCoverageZoneOverrides,
  minCoverageZoneHeightPercent,
  minCoverageZoneWidthPercent,
}: UseCoverageZoneDragParams): UseCoverageZoneDragResult {
  const dragCoverageZoneHandleRef = useRef<{
    zoneId: string;
    handle: ZoneHandleDirection;
    pointerId: number;
  } | null>(null);

  useEffect(() => {
    if (!selectedCoverageZoneId) {
      return;
    }

    const selectedZoneStillExists = renderedDefenseCoverageZones.some(
      (zone) => zone.id === selectedCoverageZoneId,
    );
    if (!selectedZoneStillExists) {
      setSelectedCoverageZoneId(null);
    }
  }, [
    renderedDefenseCoverageZones,
    selectedCoverageZoneId,
    setSelectedCoverageZoneId,
  ]);

  const handleCoverageZoneLabelClick =
    (zoneId: string) => (event: MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setSelectedCoverageZoneId(zoneId);
    };

  const updateCoverageZoneFromClient = useCallback(
    (
      zoneId: string,
      handle: ZoneHandleDirection,
      clientX: number,
      clientY: number,
    ) => {
      const drawingSurface = drawingSurfaceRef.current;
      if (!drawingSurface || isDrawEnabled) {
        return;
      }

      const rect = drawingSurface.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const pointerXPercent = clamp(
        ((clientX - rect.left) / rect.width) * 100,
        0,
        100,
      );
      const pointerYPercent = clamp(
        ((clientY - rect.top) / rect.height) * 100,
        0,
        100,
      );

      setCoverageZoneOverrides((current) => {
        const renderedZone = renderedDefenseCoverageZones.find(
          (zone) => zone.id === zoneId,
        );
        if (!renderedZone) {
          return current;
        }

        const baseRect = current[zoneId] ?? {
          leftPercent: renderedZone.leftPercent,
          top: renderedZone.top,
          widthPercent: renderedZone.widthPercent,
          height: renderedZone.height,
        };

        const currentBottom = baseRect.top + baseRect.height;
        const currentRight = baseRect.leftPercent + baseRect.widthPercent;
        let nextRect = baseRect;

        if (handle === "top") {
          const nextTop = clamp(
            pointerYPercent,
            0,
            currentBottom - minCoverageZoneHeightPercent,
          );
          nextRect = {
            ...baseRect,
            top: nextTop,
            height: currentBottom - nextTop,
          };
        }

        if (handle === "bottom") {
          const nextBottom = clamp(
            pointerYPercent,
            baseRect.top + minCoverageZoneHeightPercent,
            lineOfScrimmageTop,
          );
          nextRect = {
            ...baseRect,
            height: nextBottom - baseRect.top,
          };
        }

        if (handle === "left") {
          const nextLeft = clamp(
            pointerXPercent,
            0,
            currentRight - minCoverageZoneWidthPercent,
          );
          nextRect = {
            ...baseRect,
            leftPercent: nextLeft,
            widthPercent: currentRight - nextLeft,
          };
        }

        if (handle === "right") {
          const nextRight = clamp(
            pointerXPercent,
            baseRect.leftPercent + minCoverageZoneWidthPercent,
            100,
          );
          nextRect = {
            ...baseRect,
            widthPercent: nextRight - baseRect.leftPercent,
          };
        }

        const normalizedTop = clamp(
          nextRect.top,
          0,
          Math.max(0, lineOfScrimmageTop - minCoverageZoneHeightPercent),
        );
        const normalizedHeight = clamp(
          nextRect.height,
          minCoverageZoneHeightPercent,
          Math.max(
            minCoverageZoneHeightPercent,
            lineOfScrimmageTop - normalizedTop,
          ),
        );
        const normalizedLeft = clamp(
          nextRect.leftPercent,
          0,
          100 - minCoverageZoneWidthPercent,
        );
        const normalizedWidth = clamp(
          nextRect.widthPercent,
          minCoverageZoneWidthPercent,
          Math.max(minCoverageZoneWidthPercent, 100 - normalizedLeft),
        );

        const normalizedRect: EditableCoverageZoneRect = {
          leftPercent: normalizedLeft,
          top: normalizedTop,
          widthPercent: normalizedWidth,
          height: normalizedHeight,
        };

        const hasNoChange =
          baseRect.leftPercent === normalizedRect.leftPercent &&
          baseRect.top === normalizedRect.top &&
          baseRect.widthPercent === normalizedRect.widthPercent &&
          baseRect.height === normalizedRect.height;

        if (hasNoChange) {
          return current;
        }

        return {
          ...current,
          [zoneId]: normalizedRect,
        };
      });
    },
    [
      drawingSurfaceRef,
      isDrawEnabled,
      lineOfScrimmageTop,
      minCoverageZoneHeightPercent,
      minCoverageZoneWidthPercent,
      renderedDefenseCoverageZones,
      setCoverageZoneOverrides,
    ],
  );

  const handleCoverageZoneHandlePointerDown =
    (zoneId: string, handle: ZoneHandleDirection) =>
    (event: PointerEvent<HTMLDivElement>) => {
      if (isDrawEnabled || event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setSelectedCoverageZoneId(zoneId);
      event.currentTarget.setPointerCapture(event.pointerId);
      dragCoverageZoneHandleRef.current = {
        zoneId,
        handle,
        pointerId: event.pointerId,
      };
      updateCoverageZoneFromClient(
        zoneId,
        handle,
        event.clientX,
        event.clientY,
      );
    };

  const handleCoverageZoneHandlePointerMove = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    const activeDrag = dragCoverageZoneHandleRef.current;
    if (
      !activeDrag ||
      activeDrag.pointerId !== event.pointerId ||
      isDrawEnabled
    ) {
      return;
    }

    updateCoverageZoneFromClient(
      activeDrag.zoneId,
      activeDrag.handle,
      event.clientX,
      event.clientY,
    );
  };

  const handleCoverageZoneHandlePointerUp = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    const activeDrag = dragCoverageZoneHandleRef.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragCoverageZoneHandleRef.current = null;
  };

  return {
    handleCoverageZoneLabelClick,
    handleCoverageZoneHandlePointerDown,
    handleCoverageZoneHandlePointerMove,
    handleCoverageZoneHandlePointerUp,
  };
}
