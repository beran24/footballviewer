import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { GameState, TeamKey } from "../types";
import {
  MAX_SAVED_PLAYS,
  parseSavedPlays,
  SAVED_PLAYS_STORAGE_KEY,
  type DefenseAssignmentTarget,
  type OffenseCustomRouteTarget,
  type SavedPlayRecord,
} from "../utils/savedPlays";

type UseSavedPlaysParams = {
  game: GameState;
  defenseAssignmentTargets: Record<string, DefenseAssignmentTarget>;
  defensePlayerTargets: Record<string, string>;
  offenseCustomRouteTargets: Record<string, OffenseCustomRouteTarget>;
  setGame: Dispatch<SetStateAction<GameState>>;
  setDefenseAssignmentTargets: Dispatch<
    SetStateAction<Record<string, DefenseAssignmentTarget>>
  >;
  setDefensePlayerTargets: Dispatch<SetStateAction<Record<string, string>>>;
  setOffenseCustomRouteTargets: Dispatch<
    SetStateAction<Record<string, OffenseCustomRouteTarget>>
  >;
  setSelectedPlayerRef: Dispatch<
    SetStateAction<{ teamKey: TeamKey; playerId: string } | null>
  >;
};

export type UseSavedPlaysResult = {
  savedPlays: SavedPlayRecord[];
  handleSaveCurrentPlay: (name: string) => { ok: boolean; message: string };
  handleLoadSavedPlay: (id: string) => { ok: boolean; message: string };
};

export function useSavedPlays({
  game,
  defenseAssignmentTargets,
  defensePlayerTargets,
  offenseCustomRouteTargets,
  setGame,
  setDefenseAssignmentTargets,
  setDefensePlayerTargets,
  setOffenseCustomRouteTargets,
  setSelectedPlayerRef,
}: UseSavedPlaysParams): UseSavedPlaysResult {
  const [savedPlays, setSavedPlays] = useState<SavedPlayRecord[]>([]);

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
            offenseCustomRoutes: offenseCustomRouteTargets,
            defensePlayerAssignments: defensePlayerTargets,
          },
          ...current,
        ].slice(0, MAX_SAVED_PLAYS),
      );

      return { ok: true, message: `Play "${trimmedName}" saved.` };
    },
    [
      defenseAssignmentTargets,
      defensePlayerTargets,
      game,
      offenseCustomRouteTargets,
    ],
  );

  const handleLoadSavedPlay = useCallback(
    (id: string): { ok: boolean; message: string } => {
      const match = savedPlays.find((play) => play.id === id);
      if (!match) {
        return { ok: false, message: "Saved play not found." };
      }

      setGame(match.game);
      setDefenseAssignmentTargets(match.defenseAssignments ?? {});
      setDefensePlayerTargets(match.defensePlayerAssignments ?? {});
      setOffenseCustomRouteTargets(match.offenseCustomRoutes ?? {});
      setSelectedPlayerRef(null);

      return { ok: true, message: `Loaded "${match.name}".` };
    },
    [
      savedPlays,
      setDefenseAssignmentTargets,
      setDefensePlayerTargets,
      setGame,
      setOffenseCustomRouteTargets,
      setSelectedPlayerRef,
    ],
  );

  return {
    savedPlays,
    handleSaveCurrentPlay,
    handleLoadSavedPlay,
  };
}
