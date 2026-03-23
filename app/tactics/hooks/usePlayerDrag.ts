import {
  useCallback,
  useRef,
  type Dispatch,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  FIELD_PLAYABLE_START_YARD,
  MAX_RELATIVE_FIELD_YARD,
  MIN_PLAYER_DISTANCE_FROM_LOS_YARDS,
  MIN_RELATIVE_FIELD_YARD,
  PLAYER_COLLISION_MIN_DISTANCE_PX,
  PLAYER_VERTICAL_SPREAD_FACTOR,
  TOTAL_FIELD_YARDS,
  clamp,
  toTopPercentFromPlayableYard,
} from "../constants";
import { getRenderedRelativeFieldYard } from "../utils/fieldGeometry";
import type { GameState, TeamKey } from "../types";
import type {
  DefenseAssignmentTarget,
  OffenseCustomRouteTarget,
} from "../utils/savedPlays";

type SelectedPlayerRef = {
  teamKey: TeamKey;
  playerId: string;
};

type UsePlayerDragParams = {
  drawingSurfaceRef: RefObject<HTMLDivElement | null>;
  isDrawEnabled: boolean;
  game: GameState;
  setGame: Dispatch<SetStateAction<GameState>>;
  selectedPlayerRef: SelectedPlayerRef | null;
  setSelectedPlayerRef: Dispatch<SetStateAction<SelectedPlayerRef | null>>;
  setDefenseAssignmentTargets: Dispatch<
    SetStateAction<Record<string, DefenseAssignmentTarget>>
  >;
  setDefensePlayerTargets: Dispatch<SetStateAction<Record<string, string>>>;
  setOffenseCustomRouteTargets: Dispatch<
    SetStateAction<Record<string, OffenseCustomRouteTarget>>
  >;
  formationShiftPercent: number;
};

export type UsePlayerDragResult = {
  handlePlayerPointerDown: (
    teamKey: TeamKey,
    playerId: string,
  ) => (event: PointerEvent<HTMLDivElement>) => void;
  handlePlayerPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  handlePlayerPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  handlePlayerDoubleClick: (
    teamKey: TeamKey,
    playerId: string,
  ) => (event: MouseEvent<HTMLDivElement>) => void;
};

export function usePlayerDrag({
  drawingSurfaceRef,
  isDrawEnabled,
  game,
  setGame,
  selectedPlayerRef,
  setSelectedPlayerRef,
  setDefenseAssignmentTargets,
  setDefensePlayerTargets,
  formationShiftPercent,
}: UsePlayerDragParams): UsePlayerDragResult {
  const dragPlayerRef = useRef<{
    teamKey: TeamKey;
    playerId: string;
    pointerId: number;
  } | null>(null);

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
      drawingSurfaceRef,
      formationShiftPercent,
      game.defense.players,
      game.offense.players,
      game.settings.lineOfScrimmageYard,
      game.settings.playersLocked,
      setGame,
    ],
  );

  const handlePlayerPointerDown =
    (teamKey: TeamKey, playerId: string) =>
    (event: PointerEvent<HTMLDivElement>) => {
      if (isDrawEnabled || event.button !== 0) {
        return;
      }

      const isAssignmentModifierPressed = event.ctrlKey || event.metaKey;
      if (
        isAssignmentModifierPressed &&
        game.settings.playersLocked &&
        teamKey === "offense" &&
        selectedPlayerRef?.teamKey === "defense"
      ) {
        event.preventDefault();
        event.stopPropagation();
        setDefensePlayerTargets((current) => ({
          ...current,
          [selectedPlayerRef.playerId]: playerId,
        }));
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

  const handlePlayerPointerMove = (event: PointerEvent<HTMLDivElement>) => {
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

  const handlePlayerPointerUp = (event: PointerEvent<HTMLDivElement>) => {
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
    (event: MouseEvent<HTMLDivElement>) => {
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

      setDefensePlayerTargets((current) => {
        if (!(playerId in current)) {
          return current;
        }

        const next = { ...current };
        delete next[playerId];
        return next;
      });
    };

  return {
    handlePlayerPointerDown,
    handlePlayerPointerMove,
    handlePlayerPointerUp,
    handlePlayerDoubleClick,
  };
}
