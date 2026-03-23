import type { MouseEvent, PointerEvent } from "react";
import type { RenderedDefenseCoverageZone } from "../utils/overlays";

type ZoneHandleDirection = "top" | "bottom" | "left" | "right";

type CoverageZonesOverlayProps = {
  renderedDefenseCoverageZones: RenderedDefenseCoverageZone[];
  selectedCoverageZoneId: string | null;
  selectedCoverageZone: RenderedDefenseCoverageZone | null;
  isDrawEnabled: boolean;
  handleCoverageZoneLabelClick: (
    zoneId: string,
  ) => (event: MouseEvent<HTMLSpanElement>) => void;
  handleCoverageZoneHandlePointerDown: (
    zoneId: string,
    handle: ZoneHandleDirection,
  ) => (event: PointerEvent<HTMLDivElement>) => void;
  handleCoverageZoneHandlePointerMove: (
    event: PointerEvent<HTMLDivElement>,
  ) => void;
  handleCoverageZoneHandlePointerUp: (
    event: PointerEvent<HTMLDivElement>,
  ) => void;
};

export function CoverageZonesOverlay({
  renderedDefenseCoverageZones,
  selectedCoverageZoneId,
  selectedCoverageZone,
  isDrawEnabled,
  handleCoverageZoneLabelClick,
  handleCoverageZoneHandlePointerDown,
  handleCoverageZoneHandlePointerMove,
  handleCoverageZoneHandlePointerUp,
}: CoverageZonesOverlayProps) {
  return (
    <>
      {renderedDefenseCoverageZones.map((zone) => {
        const isSelected = zone.id === selectedCoverageZoneId;
        return (
          <div
            key={`coverage-zone-${zone.id}`}
            className="pointer-events-none absolute z-[12]"
            style={{
              left: `${zone.leftPercent}%`,
              top: `${zone.top}%`,
              width: `${zone.widthPercent}%`,
              height: `${zone.height}%`,
              border: isSelected ? "2px solid #f59e0b" : "2px dashed #b67bff",
            }}
          >
            <span
              data-coverage-zone-ui="true"
              className={`pointer-events-auto absolute left-1/2 top-1 -translate-x-1/2 whitespace-nowrap rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isSelected ? "cursor-default bg-amber-700/90 text-amber-100" : "cursor-pointer bg-slate-900/85 text-[#d9b8ff]"}`}
              onClick={handleCoverageZoneLabelClick(zone.id)}
            >
              {zone.label}
            </span>
          </div>
        );
      })}

      {selectedCoverageZone ? (
        <>
          <div
            data-coverage-zone-ui="true"
            className={`absolute z-[44] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-100 bg-amber-500 ${isDrawEnabled ? "pointer-events-none" : "pointer-events-auto cursor-ns-resize"}`}
            style={{
              left: `${selectedCoverageZone.leftPercent + selectedCoverageZone.widthPercent / 2}%`,
              top: `${selectedCoverageZone.top}%`,
            }}
            onPointerDown={handleCoverageZoneHandlePointerDown(
              selectedCoverageZone.id,
              "top",
            )}
            onPointerMove={handleCoverageZoneHandlePointerMove}
            onPointerUp={handleCoverageZoneHandlePointerUp}
            onPointerCancel={handleCoverageZoneHandlePointerUp}
            onPointerLeave={handleCoverageZoneHandlePointerUp}
            title="Drag top edge"
          />

          <div
            data-coverage-zone-ui="true"
            className={`absolute z-[44] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-100 bg-amber-500 ${isDrawEnabled ? "pointer-events-none" : "pointer-events-auto cursor-ns-resize"}`}
            style={{
              left: `${selectedCoverageZone.leftPercent + selectedCoverageZone.widthPercent / 2}%`,
              top: `${selectedCoverageZone.top + selectedCoverageZone.height}%`,
            }}
            onPointerDown={handleCoverageZoneHandlePointerDown(
              selectedCoverageZone.id,
              "bottom",
            )}
            onPointerMove={handleCoverageZoneHandlePointerMove}
            onPointerUp={handleCoverageZoneHandlePointerUp}
            onPointerCancel={handleCoverageZoneHandlePointerUp}
            onPointerLeave={handleCoverageZoneHandlePointerUp}
            title="Drag bottom edge"
          />

          <div
            data-coverage-zone-ui="true"
            className={`absolute z-[44] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-100 bg-amber-500 ${isDrawEnabled ? "pointer-events-none" : "pointer-events-auto cursor-ew-resize"}`}
            style={{
              left: `${selectedCoverageZone.leftPercent}%`,
              top: `${selectedCoverageZone.top + selectedCoverageZone.height / 2}%`,
            }}
            onPointerDown={handleCoverageZoneHandlePointerDown(
              selectedCoverageZone.id,
              "left",
            )}
            onPointerMove={handleCoverageZoneHandlePointerMove}
            onPointerUp={handleCoverageZoneHandlePointerUp}
            onPointerCancel={handleCoverageZoneHandlePointerUp}
            onPointerLeave={handleCoverageZoneHandlePointerUp}
            title="Drag left edge"
          />

          <div
            data-coverage-zone-ui="true"
            className={`absolute z-[44] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-100 bg-amber-500 ${isDrawEnabled ? "pointer-events-none" : "pointer-events-auto cursor-ew-resize"}`}
            style={{
              left: `${selectedCoverageZone.leftPercent + selectedCoverageZone.widthPercent}%`,
              top: `${selectedCoverageZone.top + selectedCoverageZone.height / 2}%`,
            }}
            onPointerDown={handleCoverageZoneHandlePointerDown(
              selectedCoverageZone.id,
              "right",
            )}
            onPointerMove={handleCoverageZoneHandlePointerMove}
            onPointerUp={handleCoverageZoneHandlePointerUp}
            onPointerCancel={handleCoverageZoneHandlePointerUp}
            onPointerLeave={handleCoverageZoneHandlePointerUp}
            title="Drag right edge"
          />
        </>
      ) : null}
    </>
  );
}
