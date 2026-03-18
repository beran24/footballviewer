import type { DefenseFormationId, OffenseFormationId, Player } from "../types";
import formationLayoutsJson from "./formations.json";
import playerDefaultsJson from "./players.json";

type FormationUpdate = {
  lanePercent?: number;
  depthFromLos?: number;
  role?: string;
  isActive?: boolean;
  isEligible?: boolean;
};

type FormationOption<T extends string> = {
  id: T;
  label: string;
};

type FormationLayouts = {
  offense: Record<
    OffenseFormationId,
    { label: string; players: Record<string, FormationUpdate> }
  >;
  defense: Record<
    DefenseFormationId,
    { label: string; players: Record<string, FormationUpdate> }
  >;
};

type PlayerDefaults = {
  roles: Record<string, string>;
};

const formationLayouts = formationLayoutsJson as FormationLayouts;
const playerDefaults = playerDefaultsJson as PlayerDefaults;

const applyUpdates = (
  players: Player[],
  updates: Record<string, FormationUpdate>,
): Player[] =>
  players.map((player) => {
    const defaults = getDefaultsForPlayer(player.id);
    const next = updates[player.id];
    if (!next) {
      return {
        ...player,
        role: defaults.role,
        isEligible: defaults.isEligible,
        isActive: true,
      };
    }

    return {
      ...player,
      role: next.role ?? defaults.role,
      isEligible: next.isEligible ?? defaults.isEligible,
      isActive: next.isActive ?? true,
      lanePercent: next.lanePercent ?? player.lanePercent,
      depthFromLos: next.depthFromLos ?? player.depthFromLos,
    };
  });

const OFFENSE_LINEMAN_IDS = new Set(["O-C", "O-LG", "O-RG", "O-LT", "O-RT"]);

const withOffenseEligibility = (
  updates: Record<string, FormationUpdate>,
): Record<string, FormationUpdate> =>
  Object.fromEntries(
    Object.entries(updates).map(([id, update]) => [
      id,
      {
        ...update,
        isEligible: !OFFENSE_LINEMAN_IDS.has(id),
      },
    ]),
  );

const getDefaultsForPlayer = (
  id: string,
): { role: string; isEligible: boolean } => {
  const roles = playerDefaults.roles;

  if (id.startsWith("O-")) {
    return {
      role: roles[id] ?? "P",
      isEligible: !OFFENSE_LINEMAN_IDS.has(id),
    };
  }

  return { role: roles[id] ?? "P", isEligible: false };
};

export const offenseFormationOptions: FormationOption<OffenseFormationId>[] =
  Object.entries(formationLayouts.offense).map(([id, formation]) => ({
    id: id as OffenseFormationId,
    label: formation.label,
  }));

export const defenseFormationOptions: FormationOption<DefenseFormationId>[] =
  Object.entries(formationLayouts.defense).map(([id, formation]) => ({
    id: id as DefenseFormationId,
    label: formation.label,
  }));

export const getQbDepthForOffenseFormation = (
  formation: OffenseFormationId,
  qbUnderGun: boolean,
): number => {
  if (!qbUnderGun) {
    return 1.2;
  }

  const selectedFormation =
    formationLayouts.offense[formation] ?? formationLayouts.offense.spread;
  const selectedQbDepth = selectedFormation.players["O-QB"]?.depthFromLos;

  if (typeof selectedQbDepth === "number") {
    return selectedQbDepth;
  }

  const fallbackQbDepth =
    formationLayouts.offense.spread.players["O-QB"]?.depthFromLos;
  return typeof fallbackQbDepth === "number" ? fallbackQbDepth : 4.2;
};

export const applyOffenseFormation = (
  players: Player[],
  formation: OffenseFormationId,
): Player[] => {
  const updates = (
    formationLayouts.offense[formation] ?? formationLayouts.offense.spread
  ).players;
  return applyUpdates(players, withOffenseEligibility(updates));
};

export const applyDefenseFormation = (
  players: Player[],
  formation: DefenseFormationId,
): Player[] => {
  const updates = (
    formationLayouts.defense[formation] ?? formationLayouts.defense["4-3"]
  ).players;
  return applyUpdates(players, updates);
};
