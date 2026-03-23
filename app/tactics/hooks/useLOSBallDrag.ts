import { useCallback, useRef, type PointerEvent, type RefObject } from "react";
import {
  FIELD_PLAYABLE_END_YARD,
  FIELD_PLAYABLE_START_YARD,
  HASH_LEFT_PERCENT,
  HASH_RIGHT_PERCENT,
  TOTAL_FIELD_YARDS,
  clamp,
} from "../constants";

type UseLOSBallDragParams = {
  drawingSurfaceRef: RefObject<HTMLDivElement | null>;
  isDrawEnabled: boolean;
  handleLineOfScrimmageChange: (nextYard: number) => void;
  handleBallXChange: (nextXPercent: number) => void;
};

export type UseLOSBallDragResult = {
  handleLosPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  handleLosPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  handleLosPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  handleBallPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  handleBallPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  handleBallPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
};

export function useLOSBallDrag({
  drawingSurfaceRef,
  isDrawEnabled,
  handleLineOfScrimmageChange,
  handleBallXChange,
}: UseLOSBallDragParams): UseLOSBallDragResult {
  const dragLosRef = useRef<number | null>(null);
  const dragBallRef = useRef<number | null>(null);

  const updateLosFromClientY = useCallback(
    (clientY: number) => {
      const drawingSurface = drawingSurfaceRef.current;
      if (!drawingSurface) {
        return;
      }

      const rect = drawingSurface.getBoundingClientRect();
      if (rect.height <= 0) {
        return;
      }

      const absoluteYard = clamp(
        ((clientY - rect.top) / rect.height) * TOTAL_FIELD_YARDS,
        FIELD_PLAYABLE_START_YARD,
        FIELD_PLAYABLE_END_YARD,
      );

      handleLineOfScrimmageChange(absoluteYard - FIELD_PLAYABLE_START_YARD);
    },
    [drawingSurfaceRef, handleLineOfScrimmageChange],
  );

  const updateBallFromClientX = useCallback(
    (clientX: number) => {
      const drawingSurface = drawingSurfaceRef.current;
      if (!drawingSurface) {
        return;
      }

      const rect = drawingSurface.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }

      const nextXPercent = clamp(
        ((clientX - rect.left) / rect.width) * 100,
        HASH_LEFT_PERCENT,
        HASH_RIGHT_PERCENT,
      );
      handleBallXChange(nextXPercent);
    },
    [drawingSurfaceRef, handleBallXChange],
  );

  const handleLosPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isDrawEnabled || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragLosRef.current = event.pointerId;
    updateLosFromClientY(event.clientY);
  };

  const handleLosPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragLosRef.current !== event.pointerId || isDrawEnabled) {
      return;
    }

    updateLosFromClientY(event.clientY);
  };

  const handleLosPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragLosRef.current !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragLosRef.current = null;
  };

  const handleBallPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isDrawEnabled || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragBallRef.current = event.pointerId;
    updateBallFromClientX(event.clientX);
  };

  const handleBallPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragBallRef.current !== event.pointerId || isDrawEnabled) {
      return;
    }

    updateBallFromClientX(event.clientX);
  };

  const handleBallPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragBallRef.current !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragBallRef.current = null;
  };

  return {
    handleLosPointerDown,
    handleLosPointerMove,
    handleLosPointerUp,
    handleBallPointerDown,
    handleBallPointerMove,
    handleBallPointerUp,
  };
}
