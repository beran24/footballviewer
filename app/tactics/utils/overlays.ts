import type { Player, RouteId } from "../types";
import type {
  DefenseAssignmentTarget,
  OffenseCustomRouteTarget,
} from "./savedPlays";
import {
  getCommonRoutePoints,
  getRenderedRelativeFieldYard,
  type RoutePoint,
} from "./fieldGeometry";
import {
  clamp,
  toTopPercentFromPlayableYard,
  TOTAL_FIELD_YARDS,
} from "../constants";
import type { DefenseCoverageId } from "../types";

export const MAX_INELIGIBLE_BLOCK_YARDS = 10;
export const MAX_PULL_BLOCK_YARDS = 25;
export const INELIGIBLE_BLOCK_T_CAP_PX = 7;

export type EditableCoverageZoneRect = {
  leftPercent: number;
  top: number;
  widthPercent: number;
  height: number;
};

export type RenderedDefenseCoverageZone = EditableCoverageZoneRect & {
  id: string;
  label: string;
  topOffsetFromLosPercent: number;
};

export type RouteOverlay = {
  id: string;
  points: RoutePoint[];
  tip: RoutePoint;
  breakPoint: RoutePoint | null;
};

export type DefensePlayerEllipseOverlay = {
  defensePlayerId: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotation: number;
};

export type DefenseAssignmentOverlay = {
  playerId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

export type OffenseCustomRouteOverlay = {
  playerId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isEligible: boolean;
  isPullBlock: boolean;
  pathData: string | null;
  capStartX: number | null;
  capStartY: number | null;
  capEndX: number | null;
  capEndY: number | null;
};

type SurfaceSize = { width: number; height: number };

type DefenseCoverageZoneInput = {
  leftPercent: number;
  widthPercent: number;
  topOffsetFromLosPercent: number;
  heightPercent: number;
  label: string;
};

export const computeRenderedCoverageZones = (
  defenseCoverageZones: DefenseCoverageZoneInput[],
  defenseCoverageId: DefenseCoverageId,
  nearZoneCount: number,
  lineOfScrimmageTop: number,
  touchdownZonePercent: number,
  coverageZoneOverrides: Record<string, EditableCoverageZoneRect>,
  minCoverageZoneHeightPercent: number,
  minCoverageZoneWidthPercent: number,
): RenderedDefenseCoverageZone[] => {
  return defenseCoverageZones
    .map((zone, zoneIndex) => {
      const zoneId = `${defenseCoverageId}:${nearZoneCount}:${zoneIndex}`;
      const zoneBottomAtNearSeam =
        lineOfScrimmageTop - zone.topOffsetFromLosPercent;
      const isDeepZone = zone.label.toLowerCase().startsWith("deep");

      let computedZone: EditableCoverageZoneRect;
      if (isDeepZone) {
        const deepZoneBottom = Math.max(
          touchdownZonePercent,
          zoneBottomAtNearSeam,
        );
        computedZone = {
          leftPercent: zone.leftPercent,
          top: 0,
          widthPercent: zone.widthPercent,
          height: Math.max(0, deepZoneBottom),
        };
      } else {
        const rawTop = Math.max(
          0,
          lineOfScrimmageTop -
            zone.topOffsetFromLosPercent -
            zone.heightPercent,
        );
        const rawHeight = Math.max(
          0,
          Math.min(zone.heightPercent, zoneBottomAtNearSeam),
        );

        computedZone = {
          leftPercent: zone.leftPercent,
          top: rawTop,
          widthPercent: zone.widthPercent,
          height: rawHeight,
        };
      }

      const zoneRect = coverageZoneOverrides[zoneId] ?? computedZone;
      const top = clamp(
        zoneRect.top,
        0,
        Math.max(0, lineOfScrimmageTop - minCoverageZoneHeightPercent),
      );
      const height = clamp(
        zoneRect.height,
        minCoverageZoneHeightPercent,
        Math.max(minCoverageZoneHeightPercent, lineOfScrimmageTop - top),
      );
      const leftPercent = clamp(
        zoneRect.leftPercent,
        0,
        100 - minCoverageZoneWidthPercent,
      );
      const widthPercent = clamp(
        zoneRect.widthPercent,
        minCoverageZoneWidthPercent,
        Math.max(minCoverageZoneWidthPercent, 100 - leftPercent),
      );

      return {
        ...zone,
        id: zoneId,
        leftPercent,
        top,
        widthPercent,
        height,
      };
    })
    .filter((zone) => zone.height >= 1);
};

export const computeRouteOverlays = (
  offensePlayers: Player[],
  offenseCustomRouteTargets: Record<string, OffenseCustomRouteTarget>,
  los: number,
  formationShiftPercent: number,
  surfaceSize: SurfaceSize,
): RouteOverlay[] => {
  if (surfaceSize.width <= 0 || surfaceSize.height <= 0) return [];

  return offensePlayers
    .filter(
      (player) =>
        player.isActive &&
        player.isEligible &&
        player.routeId !== null &&
        !offenseCustomRouteTargets[player.id],
    )
    .map((player) => {
      const relativeFieldYard = getRenderedRelativeFieldYard(
        los,
        player.depthFromLos,
      );
      const lane = clamp(player.lanePercent + formationShiftPercent, 4, 96);
      const startX = (lane / 100) * surfaceSize.width;
      const startY =
        (toTopPercentFromPlayableYard(relativeFieldYard) / 100) *
          surfaceSize.height -
        10;
      const points = getCommonRoutePoints(
        player.routeId as RouteId,
        startX,
        startY,
        surfaceSize.width,
        surfaceSize.height,
      ).map((point) => ({
        x: clamp(point.x, 6, surfaceSize.width - 6),
        y: clamp(point.y, 6, surfaceSize.height - 6),
      }));

      const baseTip = points[points.length - 1];
      let breakPoint: RoutePoint | null = null;
      let tipAnchor = baseTip;

      if (points.length >= 3) {
        const stemStart = points[0];
        const baseBreak = points[points.length - 2];
        const stemDx = baseBreak.x - stemStart.x;
        const stemDy = baseBreak.y - stemStart.y;
        const stemLen = Math.hypot(stemDx, stemDy);
        const breakExtensionPx =
          (player.routeBreakExtension ?? 0) * surfaceSize.height;
        breakPoint =
          stemLen > 0.001
            ? {
                x: clamp(
                  stemStart.x +
                    (stemDx / stemLen) * (stemLen + breakExtensionPx),
                  6,
                  surfaceSize.width - 6,
                ),
                y: clamp(
                  stemStart.y +
                    (stemDy / stemLen) * (stemLen + breakExtensionPx),
                  6,
                  surfaceSize.height - 6,
                ),
              }
            : baseBreak;

        const breakToTipDx = baseTip.x - baseBreak.x;
        const breakToTipDy = baseTip.y - baseBreak.y;
        tipAnchor = {
          x: clamp(breakPoint.x + breakToTipDx, 6, surfaceSize.width - 6),
          y: clamp(breakPoint.y + breakToTipDy, 6, surfaceSize.height - 6),
        };
      }

      const segmentStart = breakPoint ?? points[0];
      const tipDx = tipAnchor.x - segmentStart.x;
      const tipDy = tipAnchor.y - segmentStart.y;
      const tipSegmentLength = Math.hypot(tipDx, tipDy);
      const tipExtensionPx = (player.routeExtension ?? 0) * surfaceSize.height;
      const tip =
        tipSegmentLength > 0.001
          ? {
              x: clamp(
                tipAnchor.x + (tipDx / tipSegmentLength) * tipExtensionPx,
                6,
                surfaceSize.width - 6,
              ),
              y: clamp(
                tipAnchor.y + (tipDy / tipSegmentLength) * tipExtensionPx,
                6,
                surfaceSize.height - 6,
              ),
            }
          : tipAnchor;

      const extendedPoints = breakPoint
        ? [...points.slice(0, -2), breakPoint, tip]
        : [...points.slice(0, -1), tip];

      return {
        id: player.id,
        points: extendedPoints,
        tip,
        breakPoint,
      };
    });
};

export const computeDefensePlayerEllipseOverlays = (
  defensePlayers: Player[],
  offensePlayers: Player[],
  defensePlayerTargets: Record<string, string>,
  los: number,
  formationShiftPercent: number,
  surfaceSize: SurfaceSize,
): DefensePlayerEllipseOverlay[] => {
  if (surfaceSize.width <= 0 || surfaceSize.height <= 0) return [];

  return defensePlayers
    .filter((player) => player.isActive)
    .map((player) => {
      const offensePlayerId = defensePlayerTargets[player.id];
      if (!offensePlayerId) return null;

      const offensePlayer = offensePlayers.find(
        (p) => p.id === offensePlayerId && p.isActive,
      );
      if (!offensePlayer) return null;

      const defRelativeYard = getRenderedRelativeFieldYard(
        los,
        player.depthFromLos,
      );
      const defLane = clamp(player.lanePercent + formationShiftPercent, 4, 96);
      const defX = (defLane / 100) * surfaceSize.width;
      const defY =
        (toTopPercentFromPlayableYard(defRelativeYard) / 100) *
        surfaceSize.height;

      const offRelativeYard = getRenderedRelativeFieldYard(
        los,
        offensePlayer.depthFromLos,
      );
      const offLane = clamp(
        offensePlayer.lanePercent + formationShiftPercent,
        4,
        96,
      );
      const offX = (offLane / 100) * surfaceSize.width;
      const offY =
        (toTopPercentFromPlayableYard(offRelativeYard) / 100) *
        surfaceSize.height;

      const cx = (defX + offX) / 2;
      const cy = (defY + offY) / 2;
      const c = Math.hypot(offX - defX, offY - defY) / 2;
      const rx = c + 16;
      const ry = 16;
      const rotation = Math.atan2(offY - defY, offX - defX) * (180 / Math.PI);

      return { defensePlayerId: player.id, cx, cy, rx, ry, rotation };
    })
    .filter(
      (overlay): overlay is DefensePlayerEllipseOverlay => overlay !== null,
    );
};

export const computeDefenseAssignmentOverlays = (
  defensePlayers: Player[],
  defenseAssignmentTargets: Record<string, DefenseAssignmentTarget>,
  renderedDefenseCoverageZones: RenderedDefenseCoverageZone[],
  currentCoverageId: DefenseCoverageId,
  los: number,
  formationShiftPercent: number,
  surfaceSize: SurfaceSize,
): DefenseAssignmentOverlay[] => {
  if (surfaceSize.width <= 0 || surfaceSize.height <= 0) return [];

  return defensePlayers
    .filter((player) => player.isActive)
    .map((player) => {
      const target = defenseAssignmentTargets[player.id];
      if (!target) return null;
      if (target.coverageId !== currentCoverageId) return null;

      const zone = renderedDefenseCoverageZones[target.zoneIndex];
      if (!zone) return null;

      const relativeFieldYard = getRenderedRelativeFieldYard(
        los,
        player.depthFromLos,
      );
      const lane = clamp(player.lanePercent + formationShiftPercent, 4, 96);

      return {
        playerId: player.id,
        startX: (lane / 100) * surfaceSize.width,
        startY:
          (toTopPercentFromPlayableYard(relativeFieldYard) / 100) *
          surfaceSize.height,
        endX:
          ((zone.leftPercent + zone.widthPercent / 2) / 100) *
          surfaceSize.width,
        endY: ((zone.top + zone.height / 2) / 100) * surfaceSize.height,
      };
    })
    .filter((overlay): overlay is DefenseAssignmentOverlay => overlay !== null);
};

export const computeOffenseCustomRouteOverlays = (
  offensePlayers: Player[],
  offenseCustomRouteTargets: Record<string, OffenseCustomRouteTarget>,
  los: number,
  formationShiftPercent: number,
  surfaceSize: SurfaceSize,
): OffenseCustomRouteOverlay[] => {
  if (surfaceSize.width <= 0 || surfaceSize.height <= 0) return [];

  return offensePlayers
    .filter((player) => player.isActive)
    .map((player) => {
      const target = offenseCustomRouteTargets[player.id];
      if (!target) return null;

      const relativeFieldYard = getRenderedRelativeFieldYard(
        los,
        player.depthFromLos,
      );
      const lanePercent = clamp(
        player.lanePercent + formationShiftPercent,
        4,
        96,
      );
      const topPercent = toTopPercentFromPlayableYard(relativeFieldYard);
      let deltaXPercent = target.deltaXPercent;
      let deltaYPercent = target.deltaYPercent;

      if (!player.isEligible) {
        const deltaXPx = (deltaXPercent / 100) * surfaceSize.width;
        const deltaYPx = (deltaYPercent / 100) * surfaceSize.height;
        const distancePx = Math.hypot(deltaXPx, deltaYPx);
        const maxBlockYards =
          deltaYPx > 0 ? MAX_PULL_BLOCK_YARDS : MAX_INELIGIBLE_BLOCK_YARDS;
        const maxDistancePx =
          (maxBlockYards / TOTAL_FIELD_YARDS) * surfaceSize.height;

        if (distancePx > maxDistancePx && distancePx > 0.001) {
          const ratio = maxDistancePx / distancePx;
          deltaXPercent *= ratio;
          deltaYPercent *= ratio;
        }
      }

      const endXPercent = clamp(lanePercent + deltaXPercent, 0, 100);
      const endYPercent = clamp(topPercent + deltaYPercent, 0, 100);
      const startX = (lanePercent / 100) * surfaceSize.width;
      const startY = (topPercent / 100) * surfaceSize.height;
      const draggedEndX = (endXPercent / 100) * surfaceSize.width;
      const draggedEndY = (endYPercent / 100) * surfaceSize.height;
      let endX = draggedEndX;
      let endY = draggedEndY;
      let isPullBlock = false;
      let pathData: string | null = null;
      let capStartX: number | null = null;
      let capStartY: number | null = null;
      let capEndX: number | null = null;
      let capEndY: number | null = null;

      if (!player.isEligible) {
        const maxBlockYards =
          draggedEndY > startY
            ? MAX_PULL_BLOCK_YARDS
            : MAX_INELIGIBLE_BLOCK_YARDS;
        const maxDistancePx =
          (maxBlockYards / TOTAL_FIELD_YARDS) * surfaceSize.height;
        const draggedDx = draggedEndX - startX;
        const draggedDy = draggedEndY - startY;
        const backwardDepthPx = Math.max(0, draggedDy);

        if (backwardDepthPx > 2) {
          isPullBlock = true;

          const forwardReturnY = clamp(
            -Math.max(
              10,
              Math.min(maxDistancePx * 0.3, backwardDepthPx * 0.45),
            ),
            -maxDistancePx,
            0,
          );
          const desiredFinalDx = draggedDx * 0.85;
          const desiredFinalDy = forwardReturnY;
          const desiredFinalDistance = Math.hypot(
            desiredFinalDx,
            desiredFinalDy,
          );
          const finalScale =
            desiredFinalDistance > maxDistancePx && desiredFinalDistance > 0.001
              ? maxDistancePx / desiredFinalDistance
              : 1;

          endX = startX + desiredFinalDx * finalScale;
          endY = startY + desiredFinalDy * finalScale;

          const control1X = startX + draggedDx * 0.2;
          const control1Y = startY + backwardDepthPx * 0.95;
          const control2X = startX + draggedDx * 0.95;
          const control2Y = startY + backwardDepthPx * 0.9;
          pathData = `M ${startX} ${startY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${endX} ${endY}`;

          const tangentX = endX - control2X;
          const tangentY = endY - control2Y;
          const tangentLength = Math.hypot(tangentX, tangentY);

          if (tangentLength > 0.001) {
            const perpendicularX = -tangentY / tangentLength;
            const perpendicularY = tangentX / tangentLength;
            capStartX = endX - perpendicularX * INELIGIBLE_BLOCK_T_CAP_PX;
            capStartY = endY - perpendicularY * INELIGIBLE_BLOCK_T_CAP_PX;
            capEndX = endX + perpendicularX * INELIGIBLE_BLOCK_T_CAP_PX;
            capEndY = endY + perpendicularY * INELIGIBLE_BLOCK_T_CAP_PX;
          }
        }

        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.hypot(dx, dy);

        if (!isPullBlock && distance > 0.001) {
          const perpendicularX = -dy / distance;
          const perpendicularY = dx / distance;
          capStartX = endX - perpendicularX * INELIGIBLE_BLOCK_T_CAP_PX;
          capStartY = endY - perpendicularY * INELIGIBLE_BLOCK_T_CAP_PX;
          capEndX = endX + perpendicularX * INELIGIBLE_BLOCK_T_CAP_PX;
          capEndY = endY + perpendicularY * INELIGIBLE_BLOCK_T_CAP_PX;
        } else if (!isPullBlock) {
          capStartX = endX;
          capStartY = endY - INELIGIBLE_BLOCK_T_CAP_PX;
          capEndX = endX;
          capEndY = endY + INELIGIBLE_BLOCK_T_CAP_PX;
        }
      }

      return {
        playerId: player.id,
        startX,
        startY,
        endX,
        endY,
        isEligible: player.isEligible,
        isPullBlock,
        pathData,
        capStartX,
        capStartY,
        capEndX,
        capEndY,
      };
    })
    .filter(
      (overlay): overlay is OffenseCustomRouteOverlay => overlay !== null,
    );
};
