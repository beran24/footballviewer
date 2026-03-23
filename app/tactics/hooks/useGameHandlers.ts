import { useCallback, type Dispatch, type SetStateAction } from "react";
import {
  HASH_LEFT_PERCENT,
  HASH_RIGHT_PERCENT,
  PLAYABLE_FIELD_YARDS,
  applyDefenseFormation,
  applyOffenseFormation,
  clamp,
  getQbDepthForOffenseFormation,
} from "../constants";
import { makeDefensePlayers } from "../gameSetup";
import type {
  DefenseCoverageId,
  DefenseFormationId,
  GameState,
  NearZoneCount,
  OffenseFormationId,
} from "../types";
import type {
  DefenseAssignmentTarget,
  OffenseCustomRouteTarget,
} from "../utils/savedPlays";

type UseGameHandlersParams = {
  setGame: Dispatch<SetStateAction<GameState>>;
  setDefenseAssignmentTargets: Dispatch<
    SetStateAction<Record<string, DefenseAssignmentTarget>>
  >;
  setDefensePlayerTargets: Dispatch<SetStateAction<Record<string, string>>>;
  setOffenseCustomRouteTargets: Dispatch<
    SetStateAction<Record<string, OffenseCustomRouteTarget>>
  >;
};

export type UseGameHandlersResult = {
  handleLineOfScrimmageChange: (nextYard: number) => void;
  handleBallXChange: (nextXPercent: number) => void;
  handleOffenseFormationChange: (formation: OffenseFormationId) => void;
  handleQbUnderGunChange: (nextValue: boolean) => void;
  handlePlayersLockedChange: (nextValue: boolean) => void;
  handleDefenseFormationChange: (formation: DefenseFormationId) => void;
  handleDefenseCoverageChange: (coverage: DefenseCoverageId) => void;
  handleNearZoneCountChange: (count: NearZoneCount) => void;
};

export function useGameHandlers({
  setGame,
  setDefenseAssignmentTargets,
  setDefensePlayerTargets,
  setOffenseCustomRouteTargets,
}: UseGameHandlersParams): UseGameHandlersResult {
  const handleLineOfScrimmageChange = useCallback(
    (nextYard: number) => {
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
    },
    [setGame],
  );

  const handleBallXChange = useCallback(
    (nextXPercent: number) => {
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
    },
    [setGame],
  );

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
    [setGame],
  );

  const handleQbUnderGunChange = useCallback(
    (nextValue: boolean) => {
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
    },
    [setGame],
  );

  const handlePlayersLockedChange = useCallback(
    (nextValue: boolean) => {
      setGame((current) => ({
        ...current,
        settings: {
          ...current.settings,
          playersLocked: nextValue,
        },
      }));

      if (!nextValue) {
        setDefenseAssignmentTargets({});
        setDefensePlayerTargets({});
        setOffenseCustomRouteTargets({});
      }
    },
    [
      setDefenseAssignmentTargets,
      setDefensePlayerTargets,
      setGame,
      setOffenseCustomRouteTargets,
    ],
  );

  const handleDefenseFormationChange = useCallback(
    (formation: DefenseFormationId) => {
      setGame((current) => ({
        ...current,
        defense: {
          ...current.defense,
          players: applyDefenseFormation(
            makeDefensePlayers().map(
              (defaultPlayer) =>
                current.defense.players.find(
                  (player) => player.id === defaultPlayer.id,
                ) ?? defaultPlayer,
            ),
            formation,
          ),
        },
        settings: {
          ...current.settings,
          defenseFormation: formation,
        },
      }));
    },
    [setGame],
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
    [setDefenseAssignmentTargets, setGame],
  );

  const handleNearZoneCountChange = useCallback(
    (count: NearZoneCount) => {
      setGame((current) => ({
        ...current,
        settings: {
          ...current.settings,
          nearZoneCount: count,
        },
      }));

      setDefenseAssignmentTargets({});
    },
    [setDefenseAssignmentTargets, setGame],
  );

  return {
    handleLineOfScrimmageChange,
    handleBallXChange,
    handleOffenseFormationChange,
    handleQbUnderGunChange,
    handlePlayersLockedChange,
    handleDefenseFormationChange,
    handleDefenseCoverageChange,
    handleNearZoneCountChange,
  };
}
