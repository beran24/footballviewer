import type { DefenseCoverageId, GameState, NearZoneCount } from "../types";

export type DefenseAssignmentTarget = {
  coverageId: DefenseCoverageId;
  zoneIndex: number;
};

export type OffenseCustomRouteTarget = {
  deltaXPercent: number;
  deltaYPercent: number;
};

export type SavedPlayRecord = {
  id: string;
  name: string;
  updatedAt: string;
  game: GameState;
  defenseAssignments: Record<string, DefenseAssignmentTarget>;
  offenseCustomRoutes: Record<string, OffenseCustomRouteTarget>;
  defensePlayerAssignments: Record<string, string>;
};

export const SAVED_PLAYS_STORAGE_KEY = "footballviewer.tactics.savedPlays.v1";
export const MAX_SAVED_PLAYS = 50;

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isNearZoneCount = (value: unknown): value is NearZoneCount =>
  value === 3 || value === 4 || value === 5;

export const isPlayableGameState = (value: unknown): value is GameState => {
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

export const parseSavedPlays = (rawValue: string | null): SavedPlayRecord[] => {
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

        const defenseAssignmentCandidate = entry.defenseAssignments;
        const offenseCustomRouteCandidate = entry.offenseCustomRoutes;
        return (
          typeof entry.id === "string" &&
          typeof entry.name === "string" &&
          typeof entry.updatedAt === "string" &&
          isPlayableGameState(entry.game) &&
          (defenseAssignmentCandidate === undefined ||
            isObject(defenseAssignmentCandidate)) &&
          (offenseCustomRouteCandidate === undefined ||
            isObject(offenseCustomRouteCandidate))
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
        offenseCustomRoutes:
          (entry.offenseCustomRoutes as Record<
            string,
            OffenseCustomRouteTarget
          >) ?? {},
        defensePlayerAssignments:
          (entry.defensePlayerAssignments as Record<string, string>) ?? {},
      }));
  } catch {
    return [];
  }
};
