"use client";

import { useCallback, useRef, useState } from "react";
import {
  FIELD_PLAYABLE_END_YARD,
  FIELD_PLAYABLE_START_YARD,
  HASH_LEFT_PERCENT,
  HASH_RIGHT_PERCENT,
  MAX_RELATIVE_FIELD_YARD,
  PLAYER_COLLISION_MIN_DISTANCE_PX,
  MIN_PLAYER_DISTANCE_FROM_LOS_YARDS,
  MIN_RELATIVE_FIELD_YARD,
  PLAYABLE_FIELD_YARDS,
  PLAYER_VERTICAL_SPREAD_FACTOR,
  TOTAL_FIELD_YARDS,
  clamp,
  toTopPercentFromPlayableYard,
  getDefenseCoverageZones,
} from "./constants";
import { CoverageZonesOverlay } from "./components/CoverageZonesOverlay";
import { FieldBackground } from "./components/FieldBackground";
import { FieldOverlaySVG } from "./components/FieldOverlaySVG";
import { TeamPlayerNodes } from "./components/TeamPlayerNodes";
import { TacticsSidebar } from "./components/TacticsSidebar";
import { DrawingProvider } from "./DrawingProvider";
import {
  GameStateProvider,
  type GameStateContextValue,
  type SavedPlaySummary,
} from "./GameStateProvider";
import { useCanvasDrawing } from "./hooks/useCanvasDrawing";
import { useGameHandlers } from "./hooks/useGameHandlers";
import { useLOSBallDrag } from "./hooks/useLOSBallDrag";
import { usePlayerDrag } from "./hooks/usePlayerDrag";
import { useRouteDragHandlers } from "./hooks/useRouteDragHandlers";
import { useSavedPlays } from "./hooks/useSavedPlays";
import { useCoverageZoneDrag } from "./hooks/useCoverageZoneDrag";
import { useFieldPointerHandler } from "./hooks/useFieldPointerHandler";
import { initialGameState } from "./gameSetup";
import type { GameState, RouteId, TeamKey } from "./types";
import {
  type DefenseAssignmentTarget,
  type OffenseCustomRouteTarget,
} from "./utils/savedPlays";
import {
  computeRouteOverlays,
  computeDefensePlayerEllipseOverlays,
  computeDefenseAssignmentOverlays,
  computeOffenseCustomRouteOverlays,
  computeRenderedCoverageZones,
  type RouteOverlay,
  type DefensePlayerEllipseOverlay,
  type DefenseAssignmentOverlay,
  type OffenseCustomRouteOverlay,
  type EditableCoverageZoneRect,
  type RenderedDefenseCoverageZone,
} from "./utils/overlays";

const MIN_COVERAGE_ZONE_HEIGHT_PERCENT = 2;
const MIN_COVERAGE_ZONE_WIDTH_PERCENT = 4;

export default function TacticsPage() {
  const drawingSurfaceRef = useRef<HTMLDivElement | null>(null);

  const {
    canvasRef,
    surfaceSize,
    isDrawEnabled,
    setIsDrawEnabled,
    strokeColor,
    setStrokeColor,
    lineWidth,
    setLineWidth,
    hasDrawing,
    clearCanvas,
    handlePointerDown,
    handlePointerMove,
    finishDrawing,
  } = useCanvasDrawing({ drawingSurfaceRef });

  const [game, setGame] = useState<GameState>(initialGameState);
  const [selectedPlayerRef, setSelectedPlayerRef] = useState<{
    teamKey: TeamKey;
    playerId: string;
  } | null>(null);
  const [defenseAssignmentTargets, setDefenseAssignmentTargets] = useState<
    Record<string, DefenseAssignmentTarget>
  >({});
  const [defensePlayerTargets, setDefensePlayerTargets] = useState<
    Record<string, string>
  >({});
  const [offenseCustomRouteTargets, setOffenseCustomRouteTargets] = useState<
    Record<string, OffenseCustomRouteTarget>
  >({});
  const [coverageZoneOverrides, setCoverageZoneOverrides] = useState<
    Record<string, EditableCoverageZoneRect>
  >({});
  const [selectedCoverageZoneId, setSelectedCoverageZoneId] = useState<
    string | null
  >(null);

  const {
    handleLineOfScrimmageChange,
    handleBallXChange,
    handleOffenseFormationChange,
    handleQbUnderGunChange,
    handlePlayersLockedChange,
    handleDefenseFormationChange,
    handleDefenseCoverageChange,
    handleNearZoneCountChange,
  } = useGameHandlers({
    setGame,
    setDefenseAssignmentTargets,
    setDefensePlayerTargets,
    setOffenseCustomRouteTargets,
  });

  const { savedPlays, handleSaveCurrentPlay, handleLoadSavedPlay } =
    useSavedPlays({
      game,
      defenseAssignmentTargets,
      defensePlayerTargets,
      offenseCustomRouteTargets,
      setGame,
      setDefenseAssignmentTargets,
      setDefensePlayerTargets,
      setOffenseCustomRouteTargets,
      setSelectedPlayerRef,
    });

  const {
    handleLosPointerDown,
    handleLosPointerMove,
    handleLosPointerUp,
    handleBallPointerDown,
    handleBallPointerMove,
    handleBallPointerUp,
  } = useLOSBallDrag({
    drawingSurfaceRef,
    isDrawEnabled,
    handleLineOfScrimmageChange,
    handleBallXChange,
  });

  const formationShiftPercent =
    game.settings.ballXPercent - (HASH_LEFT_PERCENT + HASH_RIGHT_PERCENT) / 2;

  const {
    handlePlayerPointerDown,
    handlePlayerPointerMove,
    handlePlayerPointerUp,
    handlePlayerDoubleClick,
  } = usePlayerDrag({
    drawingSurfaceRef,
    isDrawEnabled,
    game,
    setGame,
    selectedPlayerRef,
    setSelectedPlayerRef,
    setDefenseAssignmentTargets,
    setDefensePlayerTargets,
    setOffenseCustomRouteTargets,
    formationShiftPercent,
  });

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
    selectedPlayerRef?.teamKey === "offense" &&
    selectedPlayer?.isEligible &&
    !offenseCustomRouteTargets[selectedPlayerRef.playerId]
      ? selectedPlayerRef.playerId
      : null;

  const {
    handleRouteTipPointerDown,
    handleRouteTipPointerMove,
    handleRouteTipPointerUp,
    handleRouteBreakPointerDown,
    handleRouteBreakPointerMove,
    handleRouteBreakPointerUp,
  } = useRouteDragHandlers({
    drawingSurfaceRef,
    isDrawEnabled,
    selectedOffenseRoutePlayerId,
    formationShiftPercent,
    game,
    setGame,
  });

  const defenseCoverageZones = getDefenseCoverageZones(
    game.settings.defenseCoverage,
    game.settings.nearZoneCount,
  );
  const touchdownZonePercent =
    (FIELD_PLAYABLE_START_YARD / TOTAL_FIELD_YARDS) * 100;

  const renderedDefenseCoverageZones: RenderedDefenseCoverageZone[] =
    computeRenderedCoverageZones(
      defenseCoverageZones,
      game.settings.defenseCoverage,
      game.settings.nearZoneCount,
      lineOfScrimmageTop,
      touchdownZonePercent,
      coverageZoneOverrides,
      MIN_COVERAGE_ZONE_HEIGHT_PERCENT,
      MIN_COVERAGE_ZONE_WIDTH_PERCENT,
    );

  const {
    handleCoverageZoneLabelClick,
    handleCoverageZoneHandlePointerDown,
    handleCoverageZoneHandlePointerMove,
    handleCoverageZoneHandlePointerUp,
  } = useCoverageZoneDrag({
    drawingSurfaceRef,
    isDrawEnabled,
    lineOfScrimmageTop,
    renderedDefenseCoverageZones,
    selectedCoverageZoneId,
    setSelectedCoverageZoneId,
    setCoverageZoneOverrides,
    minCoverageZoneHeightPercent: MIN_COVERAGE_ZONE_HEIGHT_PERCENT,
    minCoverageZoneWidthPercent: MIN_COVERAGE_ZONE_WIDTH_PERCENT,
  });

  const selectedCoverageZone = selectedCoverageZoneId
    ? (renderedDefenseCoverageZones.find(
        (zone) => zone.id === selectedCoverageZoneId,
      ) ?? null)
    : null;

  const { handleFieldPointerDown } = useFieldPointerHandler({
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
  });

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

        setOffenseCustomRouteTargets((currentTargets) => {
          if (!(currentSelection.playerId in currentTargets)) {
            return currentTargets;
          }

          const nextTargets = { ...currentTargets };
          delete nextTargets[currentSelection.playerId];
          return nextTargets;
        });

        return currentSelection;
      });
    },
    [],
  );

  const routeOverlays: RouteOverlay[] = computeRouteOverlays(
    game.offense.players,
    offenseCustomRouteTargets,
    game.settings.lineOfScrimmageYard,
    formationShiftPercent,
    surfaceSize,
  );

  const defensePlayerEllipseOverlays: DefensePlayerEllipseOverlay[] =
    computeDefensePlayerEllipseOverlays(
      game.defense.players,
      game.offense.players,
      defensePlayerTargets,
      game.settings.lineOfScrimmageYard,
      formationShiftPercent,
      surfaceSize,
    );

  const defenseAssignmentOverlays: DefenseAssignmentOverlay[] =
    computeDefenseAssignmentOverlays(
      game.defense.players,
      defenseAssignmentTargets,
      renderedDefenseCoverageZones,
      game.settings.defenseCoverage,
      game.settings.lineOfScrimmageYard,
      formationShiftPercent,
      surfaceSize,
    );

  const offenseCustomRouteOverlays: OffenseCustomRouteOverlay[] =
    computeOffenseCustomRouteOverlays(
      game.offense.players,
      offenseCustomRouteTargets,
      game.settings.lineOfScrimmageYard,
      formationShiftPercent,
      surfaceSize,
    );

  const drawingContextValue = {
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
            hasCustomRoute: !!offenseCustomRouteTargets[selectedPlayer.id],
            coordX: clamp(
              selectedPlayer.lanePercent + formationShiftPercent,
              4,
              96,
            ),
            coordY: selectedPlayer.depthFromLos,
          }
        : null,
    onSelectedPlayerLabelChange: handleSelectedPlayerLabelChange,
    onSelectedPlayerRouteChange: handleSelectedPlayerRouteChange,
  };

  return (
    <DrawingProvider value={drawingContextValue}>
      <GameStateProvider value={gameStateContextValue}>
        <main className="min-h-screen select-none bg-slate-950 p-4 text-slate-100 md:p-6">
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
                  <FieldBackground />

                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 h-[2px] bg-red-500"
                    style={{ top: `${lineOfScrimmageTop}%` }}
                  />

                  <CoverageZonesOverlay
                    renderedDefenseCoverageZones={renderedDefenseCoverageZones}
                    selectedCoverageZoneId={selectedCoverageZoneId}
                    selectedCoverageZone={selectedCoverageZone}
                    isDrawEnabled={isDrawEnabled}
                    handleCoverageZoneLabelClick={handleCoverageZoneLabelClick}
                    handleCoverageZoneHandlePointerDown={
                      handleCoverageZoneHandlePointerDown
                    }
                    handleCoverageZoneHandlePointerMove={
                      handleCoverageZoneHandlePointerMove
                    }
                    handleCoverageZoneHandlePointerUp={
                      handleCoverageZoneHandlePointerUp
                    }
                  />

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

                  <FieldOverlaySVG
                    surfaceSize={surfaceSize}
                    defensePlayerEllipseOverlays={defensePlayerEllipseOverlays}
                    defenseAssignmentOverlays={defenseAssignmentOverlays}
                    offenseCustomRouteOverlays={offenseCustomRouteOverlays}
                    routeOverlays={routeOverlays}
                    selectedOffenseRoutePlayerId={selectedOffenseRoutePlayerId}
                    isDrawEnabled={isDrawEnabled}
                    handleRouteTipPointerDown={handleRouteTipPointerDown}
                    handleRouteTipPointerMove={handleRouteTipPointerMove}
                    handleRouteTipPointerUp={handleRouteTipPointerUp}
                    handleRouteBreakPointerDown={handleRouteBreakPointerDown}
                    handleRouteBreakPointerMove={handleRouteBreakPointerMove}
                    handleRouteBreakPointerUp={handleRouteBreakPointerUp}
                  />

                  <TeamPlayerNodes
                    team={game.offense}
                    teamKey="offense"
                    lineOfScrimmageYard={game.settings.lineOfScrimmageYard}
                    formationShiftPercent={formationShiftPercent}
                    isDrawEnabled={isDrawEnabled}
                    playersLocked={game.settings.playersLocked}
                    handlePlayerPointerDown={handlePlayerPointerDown}
                    handlePlayerPointerMove={handlePlayerPointerMove}
                    handlePlayerPointerUp={handlePlayerPointerUp}
                    handlePlayerDoubleClick={handlePlayerDoubleClick}
                  />
                  <TeamPlayerNodes
                    team={game.defense}
                    teamKey="defense"
                    lineOfScrimmageYard={game.settings.lineOfScrimmageYard}
                    formationShiftPercent={formationShiftPercent}
                    isDrawEnabled={isDrawEnabled}
                    playersLocked={game.settings.playersLocked}
                    handlePlayerPointerDown={handlePlayerPointerDown}
                    handlePlayerPointerMove={handlePlayerPointerMove}
                    handlePlayerPointerUp={handlePlayerPointerUp}
                    handlePlayerDoubleClick={handlePlayerDoubleClick}
                  />

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
