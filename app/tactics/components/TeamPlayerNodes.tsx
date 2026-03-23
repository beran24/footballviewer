import type { MouseEvent, PointerEvent } from "react";
import type { Team, TeamKey } from "../types";
import { clamp, toTopPercentFromPlayableYard } from "../constants";
import { getRenderedRelativeFieldYard } from "../utils/fieldGeometry";

type TeamPlayerNodesProps = {
  team: Team;
  teamKey: TeamKey;
  lineOfScrimmageYard: number;
  formationShiftPercent: number;
  isDrawEnabled: boolean;
  playersLocked: boolean;
  handlePlayerPointerDown: (
    teamKey: TeamKey,
    playerId: string,
  ) => (e: PointerEvent<HTMLDivElement>) => void;
  handlePlayerPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  handlePlayerPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
  handlePlayerDoubleClick: (
    teamKey: TeamKey,
    playerId: string,
  ) => (e: MouseEvent<HTMLDivElement>) => void;
};

export function TeamPlayerNodes({
  team,
  teamKey,
  lineOfScrimmageYard,
  formationShiftPercent,
  isDrawEnabled,
  playersLocked,
  handlePlayerPointerDown,
  handlePlayerPointerMove,
  handlePlayerPointerUp,
  handlePlayerDoubleClick,
}: TeamPlayerNodesProps) {
  return (
    <>
      {team.players
        .filter((player) => player.isActive)
        .map((player) => {
          const relativeFieldYard = getRenderedRelativeFieldYard(
            lineOfScrimmageYard,
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
                className={`flex h-6 w-6 items-center justify-center rounded-full border border-white/80 text-[9px] font-bold tracking-tight shadow ${isOffenseOnLos ? "text-black" : "text-white"} ${team.colorClass} ${isDrawEnabled ? "" : playersLocked ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`}
                title={`${team.name} ${player.role}`}
              >
                {player.role}
              </div>
            </div>
          );
        })}
    </>
  );
}
