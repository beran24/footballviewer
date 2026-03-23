import {
  useCallback,
  useRef,
  type Dispatch,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import { clamp, toTopPercentFromPlayableYard } from "../constants";
import {
  getCommonRoutePoints,
  getRenderedRelativeFieldYard,
} from "../utils/fieldGeometry";
import type { GameState } from "../types";

type UseRouteDragHandlersParams = {
  drawingSurfaceRef: RefObject<HTMLDivElement | null>;
  isDrawEnabled: boolean;
  selectedOffenseRoutePlayerId: string | null;
  formationShiftPercent: number;
  game: GameState;
  setGame: Dispatch<SetStateAction<GameState>>;
};

export type UseRouteDragHandlersResult = {
  handleRouteTipPointerDown: (
    playerId: string,
  ) => (event: PointerEvent<HTMLDivElement>) => void;
  handleRouteTipPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  handleRouteTipPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  handleRouteBreakPointerDown: (
    playerId: string,
  ) => (event: PointerEvent<HTMLDivElement>) => void;
  handleRouteBreakPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  handleRouteBreakPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
};

export function useRouteDragHandlers({
  drawingSurfaceRef,
  isDrawEnabled,
  selectedOffenseRoutePlayerId,
  formationShiftPercent,
  game,
  setGame,
}: UseRouteDragHandlersParams): UseRouteDragHandlersResult {
  const dragRouteTipRef = useRef<{
    playerId: string;
    pointerId: number;
  } | null>(null);
  const dragRouteBreakRef = useRef<{
    playerId: string;
    pointerId: number;
  } | null>(null);

  const updateRouteTipFromClient = useCallback(
    (playerId: string, clientX: number, clientY: number) => {
      const drawingSurface = drawingSurfaceRef.current;
      if (!drawingSurface || isDrawEnabled) {
        return;
      }

      const rect = drawingSurface.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const player = game.offense.players.find(
        (candidate) =>
          candidate.id === playerId &&
          candidate.isActive &&
          candidate.isEligible &&
          candidate.routeId,
      );

      if (!player || !player.routeId) {
        return;
      }

      const relativeFieldYard = getRenderedRelativeFieldYard(
        game.settings.lineOfScrimmageYard,
        player.depthFromLos,
      );
      const lane = clamp(player.lanePercent + formationShiftPercent, 4, 96);
      const startX = (lane / 100) * rect.width;
      const startY =
        (toTopPercentFromPlayableYard(relativeFieldYard) / 100) * rect.height -
        10;
      const basePoints = getCommonRoutePoints(
        player.routeId,
        startX,
        startY,
        rect.width,
        rect.height,
      ).map((point) => ({
        x: clamp(point.x, 6, rect.width - 6),
        y: clamp(point.y, 6, rect.height - 6),
      }));

      if (basePoints.length < 2) {
        return;
      }

      const baseBreak = basePoints[basePoints.length - 2];
      const tipBase = basePoints[basePoints.length - 1];
      const start = basePoints[0];
      const stemDx = baseBreak.x - start.x;
      const stemDy = baseBreak.y - start.y;
      const stemLen = Math.hypot(stemDx, stemDy);
      const breakExtensionPx =
        (player.routeBreakExtension ?? 0) * Math.max(rect.height, 1);
      const breakPoint =
        basePoints.length >= 3 && stemLen > 0.001
          ? {
              x: clamp(
                start.x + (stemDx / stemLen) * (stemLen + breakExtensionPx),
                6,
                rect.width - 6,
              ),
              y: clamp(
                start.y + (stemDy / stemLen) * (stemLen + breakExtensionPx),
                6,
                rect.height - 6,
              ),
            }
          : baseBreak;
      const dx = tipBase.x - baseBreak.x;
      const dy = tipBase.y - baseBreak.y;
      const segmentLength = Math.hypot(dx, dy);
      if (segmentLength <= 0.001) {
        return;
      }

      const ux = dx / segmentLength;
      const uy = dy / segmentLength;
      const pointerX = clamp(clientX - rect.left, 0, rect.width);
      const pointerY = clamp(clientY - rect.top, 0, rect.height);
      const projectedLength =
        (pointerX - breakPoint.x) * ux + (pointerY - breakPoint.y) * uy;
      const extensionPx = clamp(
        projectedLength - segmentLength,
        0,
        rect.height * 0.7,
      );
      const extensionRatio = extensionPx / Math.max(rect.height, 1);

      setGame((current) => ({
        ...current,
        offense: {
          ...current.offense,
          players: current.offense.players.map((candidate) =>
            candidate.id === playerId
              ? { ...candidate, routeExtension: extensionRatio }
              : candidate,
          ),
        },
      }));
    },
    [
      drawingSurfaceRef,
      formationShiftPercent,
      game.offense.players,
      game.settings.lineOfScrimmageYard,
      isDrawEnabled,
      setGame,
    ],
  );

  const handleRouteTipPointerDown =
    (playerId: string) => (event: PointerEvent<HTMLDivElement>) => {
      if (isDrawEnabled || event.button !== 0) {
        return;
      }

      if (selectedOffenseRoutePlayerId !== playerId) {
        return;
      }

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRouteTipRef.current = { playerId, pointerId: event.pointerId };
      updateRouteTipFromClient(playerId, event.clientX, event.clientY);
    };

  const handleRouteTipPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const activeDrag = dragRouteTipRef.current;
    if (
      !activeDrag ||
      activeDrag.pointerId !== event.pointerId ||
      isDrawEnabled
    ) {
      return;
    }

    updateRouteTipFromClient(activeDrag.playerId, event.clientX, event.clientY);
  };

  const handleRouteTipPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const activeDrag = dragRouteTipRef.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragRouteTipRef.current = null;
  };

  const updateRouteBreakFromClient = useCallback(
    (playerId: string, clientX: number, clientY: number) => {
      const drawingSurface = drawingSurfaceRef.current;
      if (!drawingSurface || isDrawEnabled) {
        return;
      }

      const rect = drawingSurface.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const player = game.offense.players.find(
        (candidate) =>
          candidate.id === playerId &&
          candidate.isActive &&
          candidate.isEligible &&
          candidate.routeId,
      );

      if (!player || !player.routeId) {
        return;
      }

      const relativeFieldYard = getRenderedRelativeFieldYard(
        game.settings.lineOfScrimmageYard,
        player.depthFromLos,
      );
      const lane = clamp(player.lanePercent + formationShiftPercent, 4, 96);
      const startX = (lane / 100) * rect.width;
      const startY =
        (toTopPercentFromPlayableYard(relativeFieldYard) / 100) * rect.height -
        10;
      const points = getCommonRoutePoints(
        player.routeId,
        startX,
        startY,
        rect.width,
        rect.height,
      ).map((point) => ({
        x: clamp(point.x, 6, rect.width - 6),
        y: clamp(point.y, 6, rect.height - 6),
      }));

      if (points.length < 3) {
        return;
      }

      const stemStart = points[0];
      const baseBreak = points[points.length - 2];
      const stemDx = baseBreak.x - stemStart.x;
      const stemDy = baseBreak.y - stemStart.y;
      const stemLen = Math.hypot(stemDx, stemDy);
      if (stemLen <= 0.001) {
        return;
      }

      const ux = stemDx / stemLen;
      const uy = stemDy / stemLen;
      const pointerX = clamp(clientX - rect.left, 0, rect.width);
      const pointerY = clamp(clientY - rect.top, 0, rect.height);
      const projectedLength =
        (pointerX - stemStart.x) * ux + (pointerY - stemStart.y) * uy;
      const breakExtensionPx = clamp(
        projectedLength - stemLen,
        -stemLen + 8,
        rect.height * 0.6,
      );
      const breakExtensionRatio = breakExtensionPx / Math.max(rect.height, 1);

      setGame((current) => ({
        ...current,
        offense: {
          ...current.offense,
          players: current.offense.players.map((candidate) =>
            candidate.id === playerId
              ? { ...candidate, routeBreakExtension: breakExtensionRatio }
              : candidate,
          ),
        },
      }));
    },
    [
      drawingSurfaceRef,
      formationShiftPercent,
      game.offense.players,
      game.settings.lineOfScrimmageYard,
      isDrawEnabled,
      setGame,
    ],
  );

  const handleRouteBreakPointerDown =
    (playerId: string) => (event: PointerEvent<HTMLDivElement>) => {
      if (isDrawEnabled || event.button !== 0) {
        return;
      }

      if (selectedOffenseRoutePlayerId !== playerId) {
        return;
      }

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRouteBreakRef.current = { playerId, pointerId: event.pointerId };
      updateRouteBreakFromClient(playerId, event.clientX, event.clientY);
    };

  const handleRouteBreakPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const activeDrag = dragRouteBreakRef.current;
    if (
      !activeDrag ||
      activeDrag.pointerId !== event.pointerId ||
      isDrawEnabled
    ) {
      return;
    }

    updateRouteBreakFromClient(
      activeDrag.playerId,
      event.clientX,
      event.clientY,
    );
  };

  const handleRouteBreakPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const activeDrag = dragRouteBreakRef.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragRouteBreakRef.current = null;
  };

  return {
    handleRouteTipPointerDown,
    handleRouteTipPointerMove,
    handleRouteTipPointerUp,
    handleRouteBreakPointerDown,
    handleRouteBreakPointerMove,
    handleRouteBreakPointerUp,
  };
}
