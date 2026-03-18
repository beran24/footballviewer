export type Point = {
  x: number;
  y: number;
};

export type RouteId =
  | "quick-out"
  | "slant"
  | "comeback"
  | "curl"
  | "square-out"
  | "square-in"
  | "corner"
  | "post"
  | "go";

export type Player = {
  id: string;
  number: number;
  role: string;
  isActive: boolean;
  isEligible: boolean;
  routeId: RouteId | null;
  routeExtension?: number;
  routeBreakExtension?: number;
  lanePercent: number;
  depthFromLos: number;
};

export type Team = {
  name: string;
  colorClass: string;
  textClass: string;
  players: Player[];
};

export type TeamKey = "offense" | "defense";

export type OffenseFormationId =
  | "spread"
  | "i-form"
  | "trips-right"
  | "singleback"
  | "pistol"
  | "empty"
  | "wishbone"
  | "flexbone";

export type DefenseFormationId =
  | "4-3"
  | "3-4"
  | "nickel"
  | "4-2-5"
  | "dime"
  | "4-4"
  | "46";

export type DefenseCoverageId =
  | "none"
  | "cover-0"
  | "cover-1"
  | "cover-2"
  | "cover-3"
  | "cover-4"
  | "cover-6";

export type NearZoneCount = 3 | 4 | 5;

export type GameState = {
  offense: Team;
  defense: Team;
  settings: {
    lineOfScrimmageYard: number;
    ballPlayableYard: number;
    ballXPercent: number;
    offenseFormation: OffenseFormationId;
    defenseFormation: DefenseFormationId;
    defenseCoverage: DefenseCoverageId;
    nearZoneCount: NearZoneCount;
    qbUnderGun: boolean;
    playersLocked: boolean;
  };
};
