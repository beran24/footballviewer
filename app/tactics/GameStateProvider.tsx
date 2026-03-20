"use client";

import { createContext, useContext } from "react";
import type {
  DefenseCoverageId,
  DefenseFormationId,
  NearZoneCount,
  OffenseFormationId,
  RouteId,
  TeamKey,
} from "./types";

export type SelectedPlayerView = {
  teamKey: TeamKey;
  playerId: string;
  role: string;
  isEligible: boolean;
  routeId: RouteId | null;
  hasCustomRoute: boolean;
  coordX: number;
  coordY: number;
} | null;

export type SavedPlaySummary = {
  id: string;
  name: string;
  updatedAt: string;
};

export type GameStateContextValue = {
  offenseName: string;
  offenseCount: number;
  defenseName: string;
  defenseCount: number;
  offenseFormation: OffenseFormationId;
  defenseFormation: DefenseFormationId;
  defenseCoverage: DefenseCoverageId;
  nearZoneCount: NearZoneCount;
  onOffenseFormationChange: (formation: OffenseFormationId) => void;
  onDefenseFormationChange: (formation: DefenseFormationId) => void;
  onDefenseCoverageChange: (coverage: DefenseCoverageId) => void;
  onNearZoneCountChange: (count: NearZoneCount) => void;
  qbUnderGun: boolean;
  onQbUnderGunChange: (nextValue: boolean) => void;
  playersLocked: boolean;
  onPlayersLockedChange: (nextValue: boolean) => void;
  savedPlays: SavedPlaySummary[];
  onSaveCurrentPlay: (name: string) => {
    ok: boolean;
    message: string;
  };
  onLoadSavedPlay: (id: string) => {
    ok: boolean;
    message: string;
  };
  selectedPlayer: SelectedPlayerView;
  onSelectedPlayerLabelChange: (nextLabel: string) => void;
  onSelectedPlayerRouteChange: (nextRoute: RouteId | null) => void;
};

const GameStateContext = createContext<GameStateContextValue | null>(null);

export function GameStateProvider({
  value,
  children,
}: {
  value: GameStateContextValue;
  children: React.ReactNode;
}) {
  return (
    <GameStateContext.Provider value={value}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error("useGameState must be used inside GameStateProvider");
  }

  return context;
}
