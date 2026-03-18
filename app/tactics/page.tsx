"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FIELD_PLAYABLE_END_YARD,
  FIELD_PLAYABLE_START_YARD,
  HASH_LEFT_PERCENT,
  HASH_MARK_LENGTH_PERCENT,
  HASH_RIGHT_PERCENT,
  MAX_RELATIVE_FIELD_YARD,
  PLAYER_COLLISION_MIN_DISTANCE_PX,
  MIN_RENDERED_DISTANCE_FROM_LOS_YARDS,
  PLAYER_VERTICAL_SPREAD_FACTOR,
  MIN_PLAYER_DISTANCE_FROM_LOS_YARDS,
  MIN_RELATIVE_FIELD_YARD,
  PLAYABLE_FIELD_YARDS,
  TOTAL_FIELD_YARDS,
  YARD_LINE_INTERVAL,
  clamp,
  toTopPercentFromPlayableYard,
  applyDefenseFormation,
  applyOffenseFormation,
  getDefenseCoverageZones,
  getQbDepthForOffenseFormation,
} from "./constants";
import { TacticsSidebar } from "./components/TacticsSidebar";
import { DrawingProvider, type DrawingContextValue } from "./DrawingProvider";
import {
  GameStateProvider,
  type GameStateContextValue,
  type SavedPlaySummary,
} from "./GameStateProvider";
import { initialGameState } from "./gameSetup";
import type {
  DefenseCoverageId,
  DefenseFormationId,
  GameState,
  NearZoneCount,
  OffenseFormationId,
  Point,
  RouteId,
  Team,
  TeamKey,
} from "./types";

type RoutePoint = {
  x: number;
  y: number;
};

type RouteOverlay = {
  id: string;
  points: RoutePoint[];
  tip: RoutePoint;
  breakPoint: RoutePoint | null;
};

type DefenseAssignmentTarget = {
  coverageId: DefenseCoverageId;
  zoneIndex: number;
};

type DefenseAssignmentOverlay = {
  playerId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

type SavedPlayRecord = {
  id: string;
  name: string;
  updatedAt: string;
  game: GameState;
  defenseAssignments: Record<string, DefenseAssignmentTarget>;
};

const SAVED_PLAYS_STORAGE_KEY = "footballviewer.tactics.savedPlays.v1";
const MAX_SAVED_PLAYS = 50;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNearZoneCount = (value: unknown): value is NearZoneCount =>
  value === 3 || value === 4 || value === 5;

const isPlayableGameState = (value: unknown): value is GameState => {
  if (!isObject(value)) {
    return false;
  }

  const offense = value.offense;
  const defense = value.defense;
  const settings = value.settings;
  if (!isObject(offense) || !isObject(defense) || !isObject(settings)) {
    return false;
  }

  return (
    Array.isArray(offense.players) &&
    Array.isArray(defense.players) &&
    typeof settings.lineOfScrimmageYard === "number" &&
    typeof settings.ballPlayableYard === "number" &&
    typeof settings.ballXPercent === "number" &&
    typeof settings.offenseFormation === "string" &&
    typeof settings.defenseFormation === "string" &&
    typeof settings.defenseCoverage === "string" &&
    isNearZoneCount(settings.nearZoneCount) &&
    typeof settings.qbUnderGun === "boolean" &&
    typeof settings.playersLocked === "boolean"
  );
};

const parseSavedPlays = (rawValue: string | null): SavedPlayRecord[] => {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry) => {
        if (!isObject(entry)) {
          return false;
        }

        const assignmentCandidate = entry.defenseAssignments;
        return (
          typeof entry.id === "string" &&
          typeof entry.name === "string" &&
          typeof entry.updatedAt === "string" &&
          isPlayableGameState(entry.game) &&
          (assignmentCandidate === undefined || isObject(assignmentCandidate))
        );
      })
      .map((entry) => ({
        id: entry.id as string,
        name: entry.name as string,
        updatedAt: entry.updatedAt as string,
        game: entry.game as GameState,
        defenseAssignments:
          (entry.defenseAssignments as Record<
            string,
            DefenseAssignmentTarget
          >) ?? {},
      }));
  } catch {
    return [];
  }
};

const getCommonRoutePoints = (
  routeId: RouteId,
  startX: number,
  startY: number,
  fieldWidth: number,
  fieldHeight: number,
): RoutePoint[] => {
  const outsideSign = startX < fieldWidth / 2 ? -1 : 1;
  const insideSign = -outsideSign;
  const shortStem = fieldHeight * 0.11;
  const mediumStem = fieldHeight * 0.16;
  const deepStem = fieldHeight * 0.23;
  const shortBreak = fieldWidth * 0.11;
  const mediumBreak = fieldWidth * 0.16;

  if (routeId === "quick-out") {
    return [
      { x: startX, y: startY },
      { x: startX, y: startY - shortStem },
      { x: startX + outsideSign * shortBreak, y: startY - shortStem },
    ];
  }

  if (routeId === "slant") {
    return [
      { x: startX, y: startY },
      {
        x: startX + insideSign * mediumBreak,
        y: startY - mediumStem,
      },
    ];
  }

  if (routeId === "comeback") {
    return [
      { x: startX, y: startY },
      { x: startX, y: startY - deepStem },
      {
        x: startX + insideSign * shortBreak,
        y: startY - deepStem + shortStem * 0.45,
      },
    ];
  }

  if (routeId === "curl") {
    return [
      { x: startX, y: startY },
      { x: startX, y: startY - mediumStem },
      { x: startX, y: startY - mediumStem + shortStem * 0.45 },
    ];
  }

  if (routeId === "square-out") {
    return [
      { x: startX, y: startY },
      { x: startX, y: startY - mediumStem },
      { x: startX + outsideSign * mediumBreak, y: startY - mediumStem },
    ];
  }

  if (routeId === "square-in") {
    return [
      { x: startX, y: startY },
      { x: startX, y: startY - mediumStem },
      { x: startX + insideSign * mediumBreak, y: startY - mediumStem },
    ];
  }

  if (routeId === "corner") {
    return [
      { x: startX, y: startY },
      { x: startX, y: startY - mediumStem },
      {
        x: startX + outsideSign * mediumBreak,
        y: startY - deepStem,
      },
    ];
  }

  if (routeId === "post") {
    return [
      { x: startX, y: startY },
      { x: startX, y: startY - mediumStem },
      {
        x: startX + insideSign * mediumBreak,
        y: startY - deepStem,
      },
    ];
  }

  return [
    { x: startX, y: startY },
    { x: startX, y: startY - deepStem - shortStem },
  ];
};

export default function TacticsPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingSurfaceRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef(false);
  const previousPointRef = useRef<Point | null>(null);

  const dragPlayerRef = useRef<{
    teamKey: TeamKey;
    playerId: string;
    pointerId: number;
  } | null>(null);
  const dragLosRef = useRef<number | null>(null);
  const dragBallRef = useRef<number | null>(null);
  const dragRouteTipRef = useRef<{
    playerId: string;
    pointerId: number;
  } | null>(null);
  const dragRouteBreakRef = useRef<{
    playerId: string;
    pointerId: number;
  } | null>(null);

  const [strokeColor, setStrokeColor] = useState("#ffffff");
  const [lineWidth, setLineWidth] = useState(4);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [isDrawEnabled, setIsDrawEnabled] = useState(false);
  const [game, setGame] = useState<GameState>(initialGameState);
  const [selectedPlayerRef, setSelectedPlayerRef] = useState<{
    teamKey: TeamKey;
    playerId: string;
  } | null>(null);
  const [defenseAssignmentTargets, setDefenseAssignmentTargets] = useState<
    Record<string, DefenseAssignmentTarget>
  >({});
  const [savedPlays, setSavedPlays] = useState<SavedPlayRecord[]>([]);
  const [surfaceSize, setSurfaceSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const loadedPlays = parseSavedPlays(
      window.localStorage.getItem(SAVED_PLAYS_STORAGE_KEY),
    );
    setSavedPlays(loadedPlays);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        SAVED_PLAYS_STORAGE_KEY,
        JSON.stringify(savedPlays),
      );
    } catch {
      // Ignore storage write failures (private mode, quota exceeded, etc.).
    }
  }, [savedPlays]);

  const getCanvasPoint = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ): Point => {
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
  }, []);

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
  }, [resizeCanvas]);

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

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
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

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawEnabled || !isDrawingRef.current || !previousPointRef.current) {
      return;
    }

    const point = getCanvasPoint(event);
    drawSegment(previousPointRef.current, point);
    previousPointRef.current = point;
    setHasDrawing(true);
  };

  const finishDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
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

  const handleLineOfScrimmageChange = useCallback((nextYard: number) => {
    setGame((current) => {
      const clampedLos = clamp(nextYard, 0, PLAYABLE_FIELD_YARDS);
      return {
        ...current,
        settings: {
          ...current.settings,
          lineOfScrimmageYard: clampedLos,
          ballPlayableYard: clampedLos,
        },
      };
    });
  }, []);

  const handleBallXChange = useCallback((nextXPercent: number) => {
    setGame((current) => ({
      ...current,
      settings: {
        ...current.settings,
        ballXPercent: clamp(
          nextXPercent,
          HASH_LEFT_PERCENT,
          HASH_RIGHT_PERCENT,
        ),
      },
    }));
  }, []);

  const handleOffenseFormationChange = useCallback(
    (formation: OffenseFormationId) => {
      setGame((current) => ({
        ...current,
        offense: {
          ...current.offense,
          players: applyOffenseFormation(
            current.offense.players,
            formation,
          ).map((player) =>
            player.id === "O-QB"
              ? {
                  ...player,
                  depthFromLos: getQbDepthForOffenseFormation(
                    formation,
                    current.settings.qbUnderGun,
                  ),
                }
              : player,
          ),
        },
        settings: {
          ...current.settings,
          offenseFormation: formation,
        },
      }));
    },
    [],
  );

  const handleQbUnderGunChange = useCallback((nextValue: boolean) => {
    setGame((current) => ({
      ...current,
      offense: {
        ...current.offense,
        players: current.offense.players.map((player) =>
          player.id === "O-QB"
            ? {
                ...player,
                depthFromLos: getQbDepthForOffenseFormation(
                  current.settings.offenseFormation,
                  nextValue,
                ),
              }
            : player,
        ),
      },
      settings: {
        ...current.settings,
        qbUnderGun: nextValue,
      },
    }));
  }, []);

  const handlePlayersLockedChange = useCallback((nextValue: boolean) => {
    setGame((current) => ({
      ...current,
      settings: {
        ...current.settings,
        playersLocked: nextValue,
      },
    }));

    if (!nextValue) {
      setDefenseAssignmentTargets({});
    }
  }, []);

  const handleDefenseFormationChange = useCallback(
    (formation: DefenseFormationId) => {
      setGame((current) => ({
        ...current,
        defense: {
          ...current.defense,
          players: applyDefenseFormation(current.defense.players, formation),
        },
        settings: {
          ...current.settings,
          defenseFormation: formation,
        },
      }));
    },
    [],
  );

  const handleDefenseCoverageChange = useCallback(
    (coverage: DefenseCoverageId) => {
      setGame((current) => ({
        ...current,
        settings: {
          ...current.settings,
          defenseCoverage: coverage,
        },
      }));

      setDefenseAssignmentTargets({});
    },
    [],
  );

  const handleNearZoneCountChange = useCallback((count: NearZoneCount) => {
    setGame((current) => ({
      ...current,
      settings: {
        ...current.settings,
        nearZoneCount: count,
      },
    }));

    setDefenseAssignmentTargets({});
  }, []);

  const handleSaveCurrentPlay = useCallback(
    (name: string): { ok: boolean; message: string } => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return { ok: false, message: "Enter a play name before saving." };
      }

      const playId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const updatedAt = new Date().toISOString();

      setSavedPlays((current) =>
        [
          {
            id: playId,
            name: trimmedName,
            updatedAt,
            game,
            defenseAssignments: defenseAssignmentTargets,
          },
          ...current,
        ].slice(0, MAX_SAVED_PLAYS),
      );

      return { ok: true, message: `Play \"${trimmedName}\" saved.` };
    },
    [defenseAssignmentTargets, game],
  );

  const handleLoadSavedPlay = useCallback(
    (id: string): { ok: boolean; message: string } => {
      const match = savedPlays.find((play) => play.id === id);
      if (!match) {
        return { ok: false, message: "Saved play not found." };
      }

      setGame(match.game);
      setDefenseAssignmentTargets(match.defenseAssignments ?? {});
      setSelectedPlayerRef(null);

      return { ok: true, message: `Loaded \"${match.name}\".` };
    },
    [savedPlays],
  );

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
    [handleLineOfScrimmageChange],
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
    [handleBallXChange],
  );

  const handleLosPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isDrawEnabled || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragLosRef.current = event.pointerId;
    updateLosFromClientY(event.clientY);
  };

  const handleLosPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragLosRef.current !== event.pointerId || isDrawEnabled) {
      return;
    }

    updateLosFromClientY(event.clientY);
  };

  const handleLosPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragLosRef.current !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragLosRef.current = null;
  };

  const handleBallPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isDrawEnabled || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragBallRef.current = event.pointerId;
    updateBallFromClientX(event.clientX);
  };

  const handleBallPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragBallRef.current !== event.pointerId || isDrawEnabled) {
      return;
    }

    updateBallFromClientX(event.clientX);
  };

  const handleBallPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragBallRef.current !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragBallRef.current = null;
  };

  const formationShiftPercent =
    game.settings.ballXPercent - (HASH_LEFT_PERCENT + HASH_RIGHT_PERCENT) / 2;

  const getRenderedRelativeFieldYard = useCallback(
    (los: number, depthFromLos: number) => {
      const direction = depthFromLos >= 0 ? 1 : -1;
      const renderedDepthYards = Math.max(
        Math.abs(depthFromLos) * PLAYER_VERTICAL_SPREAD_FACTOR,
        MIN_RENDERED_DISTANCE_FROM_LOS_YARDS,
      );

      return clamp(
        los + direction * renderedDepthYards,
        MIN_RELATIVE_FIELD_YARD,
        MAX_RELATIVE_FIELD_YARD,
      );
    },
    [],
  );

  const updateDraggedPlayer = useCallback(
    (teamKey: TeamKey, playerId: string, clientX: number, clientY: number) => {
      if (game.settings.playersLocked) {
        return;
      }

      const drawingSurface = drawingSurfaceRef.current;
      if (!drawingSurface) {
        return;
      }

      const rect = drawingSurface.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const displayedLanePercent = clamp(
        ((clientX - rect.left) / rect.width) * 100,
        4,
        96,
      );
      const nextLanePercent = clamp(
        displayedLanePercent - formationShiftPercent,
        4,
        96,
      );

      const absoluteYard = clamp(
        ((clientY - rect.top) / rect.height) * TOTAL_FIELD_YARDS,
        0,
        TOTAL_FIELD_YARDS,
      );
      const relativeFieldYard = clamp(
        absoluteYard - FIELD_PLAYABLE_START_YARD,
        MIN_RELATIVE_FIELD_YARD,
        MAX_RELATIVE_FIELD_YARD,
      );

      const los = game.settings.lineOfScrimmageYard;
      const rawDepthFromLos =
        (relativeFieldYard - los) / PLAYER_VERTICAL_SPREAD_FACTOR;
      const constrainedDepthFromLos =
        teamKey === "offense"
          ? clamp(
              rawDepthFromLos,
              MIN_PLAYER_DISTANCE_FROM_LOS_YARDS,
              (MAX_RELATIVE_FIELD_YARD - los) / PLAYER_VERTICAL_SPREAD_FACTOR,
            )
          : clamp(
              rawDepthFromLos,
              (MIN_RELATIVE_FIELD_YARD - los) / PLAYER_VERTICAL_SPREAD_FACTOR,
              -MIN_PLAYER_DISTANCE_FROM_LOS_YARDS,
            );

      const candidateDisplayLanePercent = clamp(
        nextLanePercent + formationShiftPercent,
        4,
        96,
      );
      const candidateRenderedRelativeFieldYard = getRenderedRelativeFieldYard(
        los,
        constrainedDepthFromLos,
      );
      const candidateX = (candidateDisplayLanePercent / 100) * rect.width;
      const candidateY =
        (toTopPercentFromPlayableYard(candidateRenderedRelativeFieldYard) /
          100) *
        rect.height;

      const allOtherPlayers = [
        ...game.offense.players.map((player) => ({
          team: "offense" as const,
          player,
        })),
        ...game.defense.players.map((player) => ({
          team: "defense" as const,
          player,
        })),
      ].filter(
        (entry) =>
          entry.player.isActive &&
          !(entry.team === teamKey && entry.player.id === playerId),
      );

      const hasOverlap = allOtherPlayers.some((entry) => {
        const otherDisplayLanePercent = clamp(
          entry.player.lanePercent + formationShiftPercent,
          4,
          96,
        );
        const otherRenderedRelativeFieldYard = getRenderedRelativeFieldYard(
          los,
          entry.player.depthFromLos,
        );
        const otherX = (otherDisplayLanePercent / 100) * rect.width;
        const otherY =
          (toTopPercentFromPlayableYard(otherRenderedRelativeFieldYard) / 100) *
          rect.height;

        const deltaX = otherX - candidateX;
        const deltaY = otherY - candidateY;
        const distance = Math.hypot(deltaX, deltaY);
        return distance < PLAYER_COLLISION_MIN_DISTANCE_PX;
      });

      if (hasOverlap) {
        return;
      }

      setGame((current) => ({
        ...current,
        [teamKey]: {
          ...current[teamKey],
          players: current[teamKey].players.map((player) =>
            player.id === playerId
              ? {
                  ...player,
                  lanePercent: nextLanePercent,
                  depthFromLos: constrainedDepthFromLos,
                }
              : player,
          ),
        },
      }));
    },
    [
      formationShiftPercent,
      game.defense.players,
      game.offense.players,
      game.settings.lineOfScrimmageYard,
      game.settings.playersLocked,
      getRenderedRelativeFieldYard,
    ],
  );

  const handlePlayerPointerDown =
    (teamKey: TeamKey, playerId: string) =>
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isDrawEnabled || event.button !== 0) {
        return;
      }

      setSelectedPlayerRef({ teamKey, playerId });

      if (game.settings.playersLocked) {
        return;
      }

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragPlayerRef.current = { teamKey, playerId, pointerId: event.pointerId };
      updateDraggedPlayer(teamKey, playerId, event.clientX, event.clientY);
    };

  const handlePlayerPointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const activeDrag = dragPlayerRef.current;
    if (
      !activeDrag ||
      isDrawEnabled ||
      activeDrag.pointerId !== event.pointerId
    ) {
      return;
    }

    updateDraggedPlayer(
      activeDrag.teamKey,
      activeDrag.playerId,
      event.clientX,
      event.clientY,
    );
  };

  const handlePlayerPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const activeDrag = dragPlayerRef.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragPlayerRef.current = null;
  };

  const handlePlayerDoubleClick =
    (teamKey: TeamKey, playerId: string) =>
    (event: React.MouseEvent<HTMLDivElement>) => {
      const isAssignmentModifierPressed = event.ctrlKey || event.metaKey;
      if (teamKey !== "defense" || !isAssignmentModifierPressed) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      setDefenseAssignmentTargets((current) => {
        if (!(playerId in current)) {
          return current;
        }

        const next = { ...current };
        delete next[playerId];
        return next;
      });
    };

  const yardLines = Array.from(
    { length: TOTAL_FIELD_YARDS / YARD_LINE_INTERVAL + 1 },
    (_, index) => {
      const yard = index * YARD_LINE_INTERVAL;
      return {
        yard,
        topPercent: (yard / TOTAL_FIELD_YARDS) * 100,
        isGoalLine:
          yard === FIELD_PLAYABLE_START_YARD ||
          yard === FIELD_PLAYABLE_END_YARD,
        isMidfield: yard === TOTAL_FIELD_YARDS / 2,
      };
    },
  );

  const hashMarkYards = Array.from(
    { length: FIELD_PLAYABLE_END_YARD - FIELD_PLAYABLE_START_YARD - 1 },
    (_, index) => FIELD_PLAYABLE_START_YARD + 1 + index,
  );

  const lineOfScrimmageTop = toTopPercentFromPlayableYard(
    game.settings.lineOfScrimmageYard,
  );
  const ballTop = toTopPercentFromPlayableYard(
    game.settings.lineOfScrimmageYard,
  );
  const offenseCount = game.offense.players.filter(
    (player) => player.isActive,
  ).length;
  const defenseCount = game.defense.players.filter(
    (player) => player.isActive,
  ).length;

  const selectedPlayer = selectedPlayerRef
    ? (game[selectedPlayerRef.teamKey].players.find(
        (player) => player.id === selectedPlayerRef.playerId,
      ) ?? null)
    : null;

  const selectedOffenseRoutePlayerId =
    selectedPlayerRef?.teamKey === "offense" && selectedPlayer?.isEligible
      ? selectedPlayerRef.playerId
      : null;

  const defenseCoverageZones = getDefenseCoverageZones(
    game.settings.defenseCoverage,
    game.settings.nearZoneCount,
  );
  const touchdownZonePercent =
    (FIELD_PLAYABLE_START_YARD / TOTAL_FIELD_YARDS) * 100;

  const renderedDefenseCoverageZones = defenseCoverageZones
    .map((zone) => {
      const zoneBottomAtNearSeam =
        lineOfScrimmageTop - zone.topOffsetFromLosPercent;
      const isDeepZone = zone.label.toLowerCase().startsWith("deep");

      if (isDeepZone) {
        const deepZoneBottom = Math.max(
          touchdownZonePercent,
          zoneBottomAtNearSeam,
        );

        return {
          ...zone,
          top: 0,
          height: Math.max(0, deepZoneBottom),
        };
      }

      const rawTop = Math.max(
        0,
        lineOfScrimmageTop - zone.topOffsetFromLosPercent - zone.heightPercent,
      );
      const rawHeight = Math.max(
        0,
        Math.min(zone.heightPercent, zoneBottomAtNearSeam),
      );

      return {
        ...zone,
        top: rawTop,
        height: rawHeight,
      };
    })
    .filter((zone) => zone.height >= 1);

  const handleFieldPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const isAssignmentModifierPressed = event.ctrlKey || event.metaKey;
    if (
      isDrawEnabled ||
      !game.settings.playersLocked ||
      !isAssignmentModifierPressed
    ) {
      return;
    }

    if (
      !selectedPlayerRef ||
      selectedPlayerRef.teamKey !== "defense" ||
      event.button !== 0
    ) {
      return;
    }

    const targetElement = event.target as HTMLElement;
    if (targetElement.closest("[data-player-node='true']")) {
      return;
    }

    const drawingSurface = drawingSurfaceRef.current;
    if (!drawingSurface) {
      return;
    }

    const rect = drawingSurface.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const xPercent = clamp(
      ((event.clientX - rect.left) / rect.width) * 100,
      0,
      100,
    );
    const yPercent = clamp(
      ((event.clientY - rect.top) / rect.height) * 100,
      0,
      100,
    );

    const zoneIndex = renderedDefenseCoverageZones.findIndex(
      (zone) =>
        xPercent >= zone.leftPercent &&
        xPercent <= zone.leftPercent + zone.widthPercent &&
        yPercent >= zone.top &&
        yPercent <= zone.top + zone.height,
    );

    if (zoneIndex < 0) {
      return;
    }

    setDefenseAssignmentTargets((current) => ({
      ...current,
      [selectedPlayerRef.playerId]: {
        coverageId: game.settings.defenseCoverage,
        zoneIndex,
      },
    }));
  };

  const handleSelectedPlayerLabelChange = useCallback((nextLabel: string) => {
    setSelectedPlayerRef((currentSelection) => {
      if (!currentSelection) {
        return currentSelection;
      }

      const normalizedLabel = nextLabel
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 3);

      setGame((currentGame) => ({
        ...currentGame,
        [currentSelection.teamKey]: {
          ...currentGame[currentSelection.teamKey],
          players: currentGame[currentSelection.teamKey].players.map(
            (player) =>
              player.id === currentSelection.playerId
                ? { ...player, role: normalizedLabel }
                : player,
          ),
        },
      }));

      return currentSelection;
    });
  }, []);

  const handleSelectedPlayerRouteChange = useCallback(
    (nextRoute: RouteId | null) => {
      setSelectedPlayerRef((currentSelection) => {
        if (!currentSelection || currentSelection.teamKey !== "offense") {
          return currentSelection;
        }

        setGame((currentGame) => ({
          ...currentGame,
          offense: {
            ...currentGame.offense,
            players: currentGame.offense.players.map((player) =>
              player.id === currentSelection.playerId && player.isEligible
                ? {
                    ...player,
                    routeId: nextRoute,
                    routeExtension: 0,
                    routeBreakExtension: 0,
                  }
                : player,
            ),
          },
        }));

        return currentSelection;
      });
    },
    [],
  );

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
      formationShiftPercent,
      game.offense.players,
      game.settings.lineOfScrimmageYard,
      getRenderedRelativeFieldYard,
      isDrawEnabled,
    ],
  );

  const handleRouteTipPointerDown =
    (playerId: string) => (event: React.PointerEvent<HTMLDivElement>) => {
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

  const handleRouteTipPointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
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

  const handleRouteTipPointerUp = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
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
      formationShiftPercent,
      game.offense.players,
      game.settings.lineOfScrimmageYard,
      getRenderedRelativeFieldYard,
      isDrawEnabled,
    ],
  );

  const handleRouteBreakPointerDown =
    (playerId: string) => (event: React.PointerEvent<HTMLDivElement>) => {
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

  const handleRouteBreakPointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
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

  const handleRouteBreakPointerUp = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const activeDrag = dragRouteBreakRef.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragRouteBreakRef.current = null;
  };

  const routeOverlays: RouteOverlay[] =
    surfaceSize.width > 0 && surfaceSize.height > 0
      ? game.offense.players
          .filter(
            (player) =>
              player.isActive && player.isEligible && player.routeId !== null,
          )
          .map((player) => {
            const relativeFieldYard = getRenderedRelativeFieldYard(
              game.settings.lineOfScrimmageYard,
              player.depthFromLos,
            );
            const lane = clamp(
              player.lanePercent + formationShiftPercent,
              4,
              96,
            );
            const startX = (lane / 100) * surfaceSize.width;
            const startY =
              (toTopPercentFromPlayableYard(relativeFieldYard) / 100) *
                surfaceSize.height -
              10;
            const points = getCommonRoutePoints(
              player.routeId as RouteId,
              startX,
              startY,
              surfaceSize.width,
              surfaceSize.height,
            ).map((point) => ({
              x: clamp(point.x, 6, surfaceSize.width - 6),
              y: clamp(point.y, 6, surfaceSize.height - 6),
            }));

            const baseTip = points[points.length - 1];
            let breakPoint: RoutePoint | null = null;
            let tipAnchor = baseTip;

            if (points.length >= 3) {
              const stemStart = points[0];
              const baseBreak = points[points.length - 2];
              const stemDx = baseBreak.x - stemStart.x;
              const stemDy = baseBreak.y - stemStart.y;
              const stemLen = Math.hypot(stemDx, stemDy);
              const breakExtensionPx =
                (player.routeBreakExtension ?? 0) * surfaceSize.height;
              breakPoint =
                stemLen > 0.001
                  ? {
                      x: clamp(
                        stemStart.x +
                          (stemDx / stemLen) * (stemLen + breakExtensionPx),
                        6,
                        surfaceSize.width - 6,
                      ),
                      y: clamp(
                        stemStart.y +
                          (stemDy / stemLen) * (stemLen + breakExtensionPx),
                        6,
                        surfaceSize.height - 6,
                      ),
                    }
                  : baseBreak;

              const breakToTipDx = baseTip.x - baseBreak.x;
              const breakToTipDy = baseTip.y - baseBreak.y;
              tipAnchor = {
                x: clamp(breakPoint.x + breakToTipDx, 6, surfaceSize.width - 6),
                y: clamp(
                  breakPoint.y + breakToTipDy,
                  6,
                  surfaceSize.height - 6,
                ),
              };
            }

            const segmentStart = breakPoint ?? points[0];
            const tipDx = tipAnchor.x - segmentStart.x;
            const tipDy = tipAnchor.y - segmentStart.y;
            const tipSegmentLength = Math.hypot(tipDx, tipDy);
            const tipExtensionPx =
              (player.routeExtension ?? 0) * surfaceSize.height;
            const tip =
              tipSegmentLength > 0.001
                ? {
                    x: clamp(
                      tipAnchor.x + (tipDx / tipSegmentLength) * tipExtensionPx,
                      6,
                      surfaceSize.width - 6,
                    ),
                    y: clamp(
                      tipAnchor.y + (tipDy / tipSegmentLength) * tipExtensionPx,
                      6,
                      surfaceSize.height - 6,
                    ),
                  }
                : tipAnchor;

            const extendedPoints = breakPoint
              ? [...points.slice(0, -2), breakPoint, tip]
              : [...points.slice(0, -1), tip];

            return {
              id: player.id,
              points: extendedPoints,
              tip,
              breakPoint,
            };
          })
      : [];

  const defenseAssignmentOverlays: DefenseAssignmentOverlay[] =
    surfaceSize.width > 0 && surfaceSize.height > 0
      ? game.defense.players
          .filter((player) => player.isActive)
          .map((player) => {
            const target = defenseAssignmentTargets[player.id];
            if (!target) {
              return null;
            }

            if (target.coverageId !== game.settings.defenseCoverage) {
              return null;
            }

            const zone = renderedDefenseCoverageZones[target.zoneIndex];
            if (!zone) {
              return null;
            }

            const relativeFieldYard = getRenderedRelativeFieldYard(
              game.settings.lineOfScrimmageYard,
              player.depthFromLos,
            );
            const lane = clamp(
              player.lanePercent + formationShiftPercent,
              4,
              96,
            );

            return {
              playerId: player.id,
              startX: (lane / 100) * surfaceSize.width,
              startY:
                (toTopPercentFromPlayableYard(relativeFieldYard) / 100) *
                surfaceSize.height,
              endX:
                ((zone.leftPercent + zone.widthPercent / 2) / 100) *
                surfaceSize.width,
              endY: ((zone.top + zone.height / 2) / 100) * surfaceSize.height,
            };
          })
          .filter(
            (overlay): overlay is DefenseAssignmentOverlay => overlay !== null,
          )
      : [];

  const renderTeamPlayers = (team: Team, teamKey: TeamKey) =>
    team.players
      .filter((player) => player.isActive)
      .map((player) => {
        const relativeFieldYard = getRenderedRelativeFieldYard(
          game.settings.lineOfScrimmageYard,
          player.depthFromLos,
        );
        const lane = clamp(player.lanePercent + formationShiftPercent, 4, 96);
        const isOffenseOnLos =
          teamKey === "offense" && Math.abs(player.depthFromLos) <= 0.1;

        return (
          <div
            key={player.id}
            data-player-node="true"
            className={`absolute z-[42] ${isDrawEnabled ? "pointer-events-none" : "pointer-events-auto"}`}
            style={{
              top: `${toTopPercentFromPlayableYard(relativeFieldYard)}%`,
              left: `${lane}%`,
              transform: "translate(-50%, -50%)",
            }}
            onPointerDown={handlePlayerPointerDown(teamKey, player.id)}
            onPointerMove={handlePlayerPointerMove}
            onPointerUp={handlePlayerPointerUp}
            onPointerCancel={handlePlayerPointerUp}
            onPointerLeave={handlePlayerPointerUp}
            onDoubleClick={handlePlayerDoubleClick(teamKey, player.id)}
          >
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full border border-white/80 text-[9px] font-bold tracking-tight shadow ${isOffenseOnLos ? "text-black" : "text-white"} ${team.colorClass} ${isDrawEnabled ? "" : "cursor-grab active:cursor-grabbing"}`}
              title={`${team.name} ${player.role}`}
            >
              {player.role}
            </div>
          </div>
        );
      });

  const drawingContextValue: DrawingContextValue = {
    isDrawEnabled,
    onToggleDraw: () => setIsDrawEnabled((current) => !current),
    strokeColor,
    onStrokeColorChange: setStrokeColor,
    lineWidth,
    onLineWidthChange: setLineWidth,
    hasDrawing,
    onClearDrawing: clearCanvas,
  };

  const savedPlaySummaries: SavedPlaySummary[] = savedPlays.map((play) => ({
    id: play.id,
    name: play.name,
    updatedAt: play.updatedAt,
  }));

  const gameStateContextValue: GameStateContextValue = {
    offenseName: game.offense.name,
    offenseCount,
    defenseName: game.defense.name,
    defenseCount,
    offenseFormation: game.settings.offenseFormation,
    defenseFormation: game.settings.defenseFormation,
    defenseCoverage: game.settings.defenseCoverage,
    nearZoneCount: game.settings.nearZoneCount,
    onOffenseFormationChange: handleOffenseFormationChange,
    onDefenseFormationChange: handleDefenseFormationChange,
    onDefenseCoverageChange: handleDefenseCoverageChange,
    onNearZoneCountChange: handleNearZoneCountChange,
    qbUnderGun: game.settings.qbUnderGun,
    onQbUnderGunChange: handleQbUnderGunChange,
    playersLocked: game.settings.playersLocked,
    onPlayersLockedChange: handlePlayersLockedChange,
    savedPlays: savedPlaySummaries,
    onSaveCurrentPlay: handleSaveCurrentPlay,
    onLoadSavedPlay: handleLoadSavedPlay,
    selectedPlayer:
      selectedPlayerRef && selectedPlayer
        ? {
            teamKey: selectedPlayerRef.teamKey,
            playerId: selectedPlayer.id,
            role: selectedPlayer.role,
            isEligible: selectedPlayer.isEligible,
            routeId: selectedPlayer.routeId,
          }
        : null,
    onSelectedPlayerLabelChange: handleSelectedPlayerLabelChange,
    onSelectedPlayerRouteChange: handleSelectedPlayerRouteChange,
  };

  return (
    <DrawingProvider value={drawingContextValue}>
      <GameStateProvider value={gameStateContextValue}>
        <main className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 lg:h-[calc(100vh-3rem)] lg:flex-row">
            <section
              aria-label="Football tactics field"
              className="relative h-[65vh] w-full overflow-hidden rounded-2xl border border-emerald-400/40 bg-emerald-900/40 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] lg:h-auto lg:w-[80%]"
            >
              <div className="absolute inset-4 flex items-center justify-center">
                <div
                  ref={drawingSurfaceRef}
                  className="relative h-full w-full max-w-full overflow-hidden rounded-xl border border-white/35 bg-emerald-950"
                  style={{ aspectRatio: "53.3 / 120" }}
                  onPointerDown={handleFieldPointerDown}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-emerald-800 via-emerald-900 to-emerald-800" />

                  <div className="absolute inset-x-0 top-0 h-[8.333%] bg-emerald-950/70" />
                  <div className="absolute inset-x-0 bottom-0 h-[8.333%] bg-emerald-950/70" />

                  {yardLines.map((line) => (
                    <div
                      key={`yard-${line.yard}`}
                      className="absolute inset-x-0"
                      style={{ top: `${line.topPercent}%` }}
                    >
                      <div
                        className={
                          line.isMidfield
                            ? "h-[2px] bg-white/90"
                            : line.isGoalLine
                              ? "h-[2px] bg-white/85"
                              : "h-px bg-white/45"
                        }
                      />
                    </div>
                  ))}

                  {hashMarkYards.map((yard) => {
                    const topPercent = (yard / TOTAL_FIELD_YARDS) * 100;
                    return (
                      <div key={`hash-left-${yard}`}>
                        <div
                          className="absolute h-px bg-white/90"
                          style={{
                            top: `${topPercent}%`,
                            left: `${HASH_LEFT_PERCENT}%`,
                            width: `${HASH_MARK_LENGTH_PERCENT}%`,
                            transform: "translateX(-50%)",
                          }}
                        />
                        <div
                          className="absolute h-px bg-white/90"
                          style={{
                            top: `${topPercent}%`,
                            left: `${HASH_RIGHT_PERCENT}%`,
                            width: `${HASH_MARK_LENGTH_PERCENT}%`,
                            transform: "translateX(-50%)",
                          }}
                        />
                      </div>
                    );
                  })}

                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 h-[2px] bg-red-500"
                    style={{ top: `${lineOfScrimmageTop}%` }}
                  />

                  {renderedDefenseCoverageZones.map((zone, index) => (
                    <div
                      key={`coverage-zone-${game.settings.defenseCoverage}-${index}`}
                      className="pointer-events-none absolute z-[12]"
                      style={{
                        left: `${zone.leftPercent}%`,
                        top: `${zone.top}%`,
                        width: `${zone.widthPercent}%`,
                        height: `${zone.height}%`,
                        border: "2px dashed #b67bff",
                      }}
                    >
                      <span className="absolute left-1/2 top-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900/85 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#d9b8ff]">
                        {zone.label}
                      </span>
                    </div>
                  ))}

                  <div
                    className={`absolute z-20 ${isDrawEnabled ? "pointer-events-none" : "pointer-events-auto"}`}
                    style={{
                      top: `${lineOfScrimmageTop}%`,
                      left: "0%",
                      transform: "translate(-20%, -50%)",
                    }}
                    onPointerDown={handleLosPointerDown}
                    onPointerMove={handleLosPointerMove}
                    onPointerUp={handleLosPointerUp}
                    onPointerCancel={handleLosPointerUp}
                    onPointerLeave={handleLosPointerUp}
                  >
                    <div
                      className={`h-5 w-3 rounded-r-full border border-red-300/90 bg-red-500/95 ${isDrawEnabled ? "" : "cursor-ns-resize"}`}
                    />
                  </div>

                  <div
                    className={`absolute z-20 ${isDrawEnabled ? "pointer-events-none" : "pointer-events-auto"}`}
                    style={{
                      top: `${lineOfScrimmageTop}%`,
                      left: "100%",
                      transform: "translate(-80%, -50%)",
                    }}
                    onPointerDown={handleLosPointerDown}
                    onPointerMove={handleLosPointerMove}
                    onPointerUp={handleLosPointerUp}
                    onPointerCancel={handleLosPointerUp}
                    onPointerLeave={handleLosPointerUp}
                  >
                    <div
                      className={`h-5 w-3 rounded-l-full border border-red-300/90 bg-red-500/95 ${isDrawEnabled ? "" : "cursor-ns-resize"}`}
                    />
                  </div>

                  <svg
                    className="pointer-events-none absolute inset-0 z-[40]"
                    aria-hidden
                    width={surfaceSize.width}
                    height={surfaceSize.height}
                    viewBox={`0 0 ${surfaceSize.width} ${surfaceSize.height}`}
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <marker
                        id="route-arrow-black"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#000000" />
                      </marker>
                      <marker
                        id="defense-assignment-arrow"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#b67bff" />
                      </marker>
                    </defs>

                    {defenseAssignmentOverlays.map((assignment) => (
                      <line
                        key={`defense-assignment-${assignment.playerId}`}
                        x1={assignment.startX}
                        y1={assignment.startY}
                        x2={assignment.endX}
                        y2={assignment.endY}
                        stroke="#b67bff"
                        strokeWidth={3}
                        strokeLinecap="round"
                        markerEnd="url(#defense-assignment-arrow)"
                      />
                    ))}

                    {routeOverlays.map((route) => (
                      <polyline
                        key={`route-${route.id}`}
                        points={route.points
                          .map((point) => `${point.x},${point.y}`)
                          .join(" ")}
                        fill="none"
                        stroke="#000000"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        markerEnd="url(#route-arrow-black)"
                      />
                    ))}
                  </svg>

                  {routeOverlays
                    .filter(
                      (route) => route.id === selectedOffenseRoutePlayerId,
                    )
                    .map((route) => (
                      <div
                        key={`route-tip-${route.id}`}
                        className={`absolute z-[45] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-black ${isDrawEnabled ? "pointer-events-none" : "pointer-events-auto cursor-grab active:cursor-grabbing"}`}
                        style={{
                          left: `${route.tip.x}px`,
                          top: `${route.tip.y}px`,
                        }}
                        onPointerDown={handleRouteTipPointerDown(route.id)}
                        onPointerMove={handleRouteTipPointerMove}
                        onPointerUp={handleRouteTipPointerUp}
                        onPointerCancel={handleRouteTipPointerUp}
                        onPointerLeave={handleRouteTipPointerUp}
                        title="Drag route tip"
                      />
                    ))}

                  {routeOverlays
                    .filter(
                      (route) =>
                        route.id === selectedOffenseRoutePlayerId &&
                        route.breakPoint,
                    )
                    .map((route) => (
                      <div
                        key={`route-break-${route.id}`}
                        className={`absolute z-[45] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white bg-black ${isDrawEnabled ? "pointer-events-none" : "pointer-events-auto cursor-grab active:cursor-grabbing"}`}
                        style={{
                          left: `${route.breakPoint!.x}px`,
                          top: `${route.breakPoint!.y}px`,
                        }}
                        onPointerDown={handleRouteBreakPointerDown(route.id)}
                        onPointerMove={handleRouteBreakPointerMove}
                        onPointerUp={handleRouteBreakPointerUp}
                        onPointerCancel={handleRouteBreakPointerUp}
                        onPointerLeave={handleRouteBreakPointerUp}
                        title="Drag route break point"
                      />
                    ))}

                  {renderTeamPlayers(game.offense, "offense")}
                  {renderTeamPlayers(game.defense, "defense")}

                  <div
                    className={`absolute z-20 ${isDrawEnabled ? "pointer-events-none" : "pointer-events-auto"}`}
                    style={{
                      top: `${ballTop}%`,
                      left: `${game.settings.ballXPercent}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                    onPointerDown={handleBallPointerDown}
                    onPointerMove={handleBallPointerMove}
                    onPointerUp={handleBallPointerUp}
                    onPointerCancel={handleBallPointerUp}
                    onPointerLeave={handleBallPointerUp}
                  >
                    <div
                      className={`h-3 w-6 rounded-full border border-yellow-200/90 bg-amber-700 shadow ${isDrawEnabled ? "" : "cursor-ew-resize"}`}
                    />
                  </div>

                  <canvas
                    ref={canvasRef}
                    className={`absolute inset-0 z-20 touch-none select-none ${isDrawEnabled ? "cursor-crosshair" : "pointer-events-none cursor-default"}`}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={finishDrawing}
                    onPointerLeave={finishDrawing}
                    onPointerCancel={finishDrawing}
                  />
                </div>
              </div>
            </section>

            <TacticsSidebar />
          </div>
        </main>
      </GameStateProvider>
    </DrawingProvider>
  );
}
