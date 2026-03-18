import { useState } from "react";
import type {
  DefenseCoverageId,
  DefenseFormationId,
  NearZoneCount,
  OffenseFormationId,
  RouteId,
} from "../types";
import {
  defenseCoverageOptions,
  defenseFormationOptions,
  nearZoneCountOptions,
  offenseFormationOptions,
  routeOptions,
} from "../constants";
import { useDrawing } from "../DrawingProvider";
import { useGameState } from "../GameStateProvider";
import { SavedPlaysModal } from "./SavedPlaysModal";

export function TacticsSidebar() {
  const [playNameInput, setPlayNameInput] = useState("");
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [saveLoadMessage, setSaveLoadMessage] = useState<string | null>(null);

  const {
    isDrawEnabled,
    onToggleDraw,
    strokeColor,
    onStrokeColorChange,
    lineWidth,
    onLineWidthChange,
    hasDrawing,
    onClearDrawing,
  } = useDrawing();

  const {
    offenseFormation,
    defenseFormation,
    defenseCoverage,
    nearZoneCount,
    onOffenseFormationChange,
    onDefenseFormationChange,
    onDefenseCoverageChange,
    onNearZoneCountChange,
    qbUnderGun,
    onQbUnderGunChange,
    playersLocked,
    onPlayersLockedChange,
    savedPlays,
    onSaveCurrentPlay,
    onLoadSavedPlay,
    selectedPlayer,
    onSelectedPlayerLabelChange,
    onSelectedPlayerRouteChange,
  } = useGameState();

  const handleSavePlay = () => {
    const result = onSaveCurrentPlay(playNameInput);
    setSaveLoadMessage(result.message);
    if (result.ok) {
      setPlayNameInput("");
    }
  };

  const handleLoadPlay = (id: string) => {
    const result = onLoadSavedPlay(id);
    setSaveLoadMessage(result.message);
    if (result.ok) {
      setIsLoadModalOpen(false);
    }
  };

  return (
    <aside
      aria-label="Tactics settings"
      className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 p-4 shadow-lg backdrop-blur lg:w-[20%]"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Settings</h2>
        <button
          type="button"
          onClick={onToggleDraw}
          className="rounded-lg border border-slate-500 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-slate-700"
        >
          {isDrawEnabled ? "Drawing: ON" : "Drawing: OFF"}
        </button>
      </div>

      {isDrawEnabled ? (
        <div className="mt-4 space-y-4 text-sm text-slate-300">
          <label className="block">
            <span className="mb-1 block">Pen color</span>
            <input
              type="color"
              value={strokeColor}
              onChange={(event) => onStrokeColorChange(event.target.value)}
              className="h-10 w-full cursor-pointer rounded border border-slate-600 bg-slate-800"
            />
          </label>

          <label className="block">
            <span className="mb-1 block">Line width: {lineWidth}px</span>
            <input
              type="range"
              min={1}
              max={12}
              step={1}
              value={lineWidth}
              onChange={(event) =>
                onLineWidthChange(Number(event.target.value))
              }
              className="w-full"
            />
          </label>

          <button
            type="button"
            onClick={onClearDrawing}
            disabled={!hasDrawing}
            className="w-full rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 font-medium text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear drawing
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-4 text-sm text-slate-300">
          <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Game Settings
              </p>

              <label className="flex items-center gap-1.5 text-[11px] text-slate-300">
                <span>{playersLocked ? "Locked" : "Unlocked"}</span>
                <input
                  type="checkbox"
                  checked={playersLocked}
                  onChange={(event) =>
                    onPlayersLockedChange(event.target.checked)
                  }
                  className="h-3.5 w-3.5 rounded border-slate-500 bg-slate-900"
                />
              </label>
            </div>

            <label className="mt-3 block">
              <span className="mb-1 block text-xs text-slate-400">
                Play name
              </span>
              <input
                type="text"
                value={playNameInput}
                onChange={(event) => setPlayNameInput(event.target.value)}
                placeholder="Example: Cover 3 Buzz"
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-100"
              />
            </label>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleSavePlay}
                className="flex-1 rounded-md border border-emerald-500/60 bg-emerald-600/20 px-3 py-2 text-xs font-medium text-emerald-100 transition hover:bg-emerald-600/30"
              >
                Save Play
              </button>
              <button
                type="button"
                onClick={() => setIsLoadModalOpen(true)}
                className="flex-1 rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-slate-800"
              >
                Load Play
              </button>
            </div>

            {saveLoadMessage ? (
              <p className="mt-2 text-xs text-slate-300">{saveLoadMessage}</p>
            ) : null}
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Defense Settings
            </p>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">
                  Formation
                </span>
                <select
                  value={defenseFormation}
                  onChange={(event) =>
                    onDefenseFormationChange(
                      event.target.value as DefenseFormationId,
                    )
                  }
                  className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                >
                  {defenseFormationOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">
                  Coverage
                </span>
                <select
                  value={defenseCoverage}
                  onChange={(event) =>
                    onDefenseCoverageChange(
                      event.target.value as DefenseCoverageId,
                    )
                  }
                  className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                >
                  {defenseCoverageOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-3 block">
              <span className="mb-1 block text-xs text-slate-400">
                Near Zones
              </span>
              <select
                value={nearZoneCount}
                onChange={(event) =>
                  onNearZoneCountChange(
                    Number(event.target.value) as NearZoneCount,
                  )
                }
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-100"
              >
                {nearZoneCountOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Offense Settings
            </p>
            <label className="mt-2 block">
              <span className="mb-1 block text-xs text-slate-400">
                Formation
              </span>
              <select
                value={offenseFormation}
                onChange={(event) =>
                  onOffenseFormationChange(
                    event.target.value as OffenseFormationId,
                  )
                }
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-100"
              >
                {offenseFormationOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={qbUnderGun}
                onChange={(event) => onQbUnderGunChange(event.target.checked)}
                className="h-4 w-4 rounded border-slate-500 bg-slate-900"
              />
              <span>{qbUnderGun ? "QB: Under Gun" : "QB: Under Center"}</span>
            </label>
          </div>
        </div>
      )}

      {selectedPlayer ? (
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800/60 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Selected Player
          </p>
          <p className="mt-1 text-sm text-slate-200">
            {selectedPlayer.teamKey.toUpperCase()} - {selectedPlayer.playerId}
          </p>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">
                Label (max 3)
              </span>
              <input
                type="text"
                value={selectedPlayer.role}
                maxLength={3}
                onChange={(event) =>
                  onSelectedPlayerLabelChange(event.target.value)
                }
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-sm uppercase text-slate-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Route</span>
              <select
                value={
                  selectedPlayer.teamKey === "offense" &&
                  selectedPlayer.isEligible
                    ? (selectedPlayer.routeId ?? "")
                    : ""
                }
                onChange={(event) =>
                  onSelectedPlayerRouteChange(
                    event.target.value ? (event.target.value as RouteId) : null,
                  )
                }
                disabled={
                  !(
                    selectedPlayer.teamKey === "offense" &&
                    selectedPlayer.isEligible
                  )
                }
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {selectedPlayer.teamKey === "offense" &&
                selectedPlayer.isEligible ? (
                  <>
                    <option value="">No route</option>
                    {routeOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </>
                ) : (
                  <option value="">N/A</option>
                )}
              </select>
            </label>
          </div>
        </div>
      ) : null}

      <SavedPlaysModal
        isOpen={isLoadModalOpen}
        plays={savedPlays}
        onLoad={handleLoadPlay}
        onClose={() => setIsLoadModalOpen(false)}
      />
    </aside>
  );
}
