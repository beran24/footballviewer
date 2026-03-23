import {
  useCallback,
  type Dispatch,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  TOTAL_FIELD_YARDS,
  clamp,
  toTopPercentFromPlayableYard,
} from "../constants";
import { getRenderedRelativeFieldYard } from "../utils/fieldGeometry";
import {
  MAX_INELIGIBLE_BLOCK_YARDS,
  MAX_PULL_BLOCK_YARDS,
  type RenderedDefenseCoverageZone,
} from "../utils/overlays";
import type { GameState, TeamKey } from "../types";
import type {
  DefenseAssignmentTarget,
  OffenseCustomRouteTarget,
} from "../utils/savedPlays";

type SelectedPlayerRef = {
  teamKey: TeamKey;
  playerId: string;
};

type UseFieldPointerHandlerParams = {
  drawingSurfaceRef: RefObject<HTMLDivElement | null>;
  selectedCoverageZone: RenderedDefenseCoverageZone | null;
  setSelectedCoverageZoneId: Dispatch<SetStateAction<string | null>>;
  isDrawEnabled: boolean;
  game: GameState;
  selectedPlayerRef: SelectedPlayerRef | null;
  formationShiftPercent: number;
  renderedDefenseCoverageZones: RenderedDefenseCoverageZone[];
  setOffenseCustomRouteTargets: Dispatch<
    SetStateAction<Record<string, OffenseCustomRouteTarget>>
  >;
  setGame: Dispatch<SetStateAction<GameState>>;
  setDefenseAssignmentTargets: Dispatch<
    SetStateAction<Record<string, DefenseAssignmentTarget>>
  >;
};

export type UseFieldPointerHandlerResult = {
  handleFieldPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
};

export function useFieldPointerHandler({
  drawingSurfaceRef,
  selectedCoverageZone,
  setSelectedCoverageZoneId,
  isDrawEnabled,
  game,
  selectedPlayerRef,
  formationShiftPercent,
  renderedDefenseCoverageZones,
  setOffenseCustomRouteTargets,
  setGame,
  setDefenseAssignmentTargets,
}: UseFieldPointerHandlerParams): UseFieldPointerHandlerResult {
  const handleFieldPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const targetElement = event.target as HTMLElement;
      if (
        selectedCoverageZone &&
        !targetElement.closest("[data-coverage-zone-ui='true']")
      ) {
        const drawingSurface = drawingSurfaceRef.current;
        if (drawingSurface) {
          const rect = drawingSurface.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
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
            const isInsideSelectedCoverageZone =
              xPercent >= selectedCoverageZone.leftPercent &&
              xPercent <=
                selectedCoverageZone.leftPercent +
                  selectedCoverageZone.widthPercent &&
              yPercent >= selectedCoverageZone.top &&
              yPercent <=
                selectedCoverageZone.top + selectedCoverageZone.height;

            if (!isInsideSelectedCoverageZone) {
              setSelectedCoverageZoneId(null);
            }
          }
        }
      }

      const isAssignmentModifierPressed = event.ctrlKey || event.metaKey;
      if (
        isDrawEnabled ||
        !game.settings.playersLocked ||
        !isAssignmentModifierPressed
      ) {
        return;
      }

      if (!selectedPlayerRef || event.button !== 0) {
        return;
      }
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

      if (selectedPlayerRef.teamKey === "offense") {
        const selectedOffensePlayer = game.offense.players.find(
          (player) =>
            player.id === selectedPlayerRef.playerId && player.isActive,
        );
        if (!selectedOffensePlayer) {
          return;
        }

        const playerLanePercent = clamp(
          selectedOffensePlayer.lanePercent + formationShiftPercent,
          4,
          96,
        );
        const playerRelativeFieldYard = getRenderedRelativeFieldYard(
          game.settings.lineOfScrimmageYard,
          selectedOffensePlayer.depthFromLos,
        );
        const playerTopPercent = toTopPercentFromPlayableYard(
          playerRelativeFieldYard,
        );

        let deltaXPercent = clamp(xPercent - playerLanePercent, -50, 50);
        let deltaYPercent = clamp(yPercent - playerTopPercent, -50, 50);

        if (!selectedOffensePlayer.isEligible) {
          const deltaXPx = (deltaXPercent / 100) * rect.width;
          const deltaYPx = (deltaYPercent / 100) * rect.height;
          const distancePx = Math.hypot(deltaXPx, deltaYPx);
          const maxBlockYards =
            deltaYPx > 0 ? MAX_PULL_BLOCK_YARDS : MAX_INELIGIBLE_BLOCK_YARDS;
          const maxDistancePx =
            (maxBlockYards / TOTAL_FIELD_YARDS) * rect.height;

          if (distancePx > maxDistancePx && distancePx > 0.001) {
            const ratio = maxDistancePx / distancePx;
            deltaXPercent *= ratio;
            deltaYPercent *= ratio;
          }
        }

        setOffenseCustomRouteTargets((current) => ({
          ...current,
          [selectedPlayerRef.playerId]: {
            deltaXPercent,
            deltaYPercent,
          },
        }));

        // Custom route overrides the predefined route for this player.
        setGame((current) => ({
          ...current,
          offense: {
            ...current.offense,
            players: current.offense.players.map((player) =>
              player.id === selectedPlayerRef.playerId
                ? {
                    ...player,
                    routeId: null,
                    routeExtension: 0,
                    routeBreakExtension: 0,
                  }
                : player,
            ),
          },
        }));
        return;
      }

      if (selectedPlayerRef.teamKey !== "defense") {
        return;
      }

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
    },
    [
      drawingSurfaceRef,
      formationShiftPercent,
      game,
      isDrawEnabled,
      renderedDefenseCoverageZones,
      selectedCoverageZone,
      selectedPlayerRef,
      setDefenseAssignmentTargets,
      setGame,
      setOffenseCustomRouteTargets,
      setSelectedCoverageZoneId,
    ],
  );

  return {
    handleFieldPointerDown,
  };
}
