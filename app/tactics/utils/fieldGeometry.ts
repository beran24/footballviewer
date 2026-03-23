import type { RouteId } from "../types";
import {
  MAX_RELATIVE_FIELD_YARD,
  MIN_RENDERED_DISTANCE_FROM_LOS_YARDS,
  MIN_RELATIVE_FIELD_YARD,
  PLAYER_VERTICAL_SPREAD_FACTOR,
  clamp,
} from "../constants";

export type RoutePoint = {
  x: number;
  y: number;
};

export const getRenderedRelativeFieldYard = (
  los: number,
  depthFromLos: number,
): number => {
  const direction = depthFromLos >= 0 ? 1 : -1;
  const renderedDepthYards = Math.max(
    Math.abs(depthFromLos) * PLAYER_VERTICAL_SPREAD_FACTOR,
    MIN_RENDERED_DISTANCE_FROM_LOS_YARDS,
  );

  return clamp(
    los + direction * renderedDepthYards,
    MIN_RELATIVE_FIELD_YARD,
    MAX_RELATIVE_FIELD_YARD,
  );
};

export const getCommonRoutePoints = (
  routeId: RouteId,
  startX: number,
  startY: number,
  fieldWidth: number,
  fieldHeight: number,
): RoutePoint[] => {
  const outsideSign = startX < fieldWidth / 2 ? -1 : 1;
  const insideSign = -outsideSign;
  const shortStem = fieldHeight * 0.11;
  const mediumStem = fieldHeight * 0.16;
  const deepStem = fieldHeight * 0.23;
  const shortBreak = fieldWidth * 0.11;
  const mediumBreak = fieldWidth * 0.16;

  if (routeId === "quick-out") {
    return [
      { x: startX, y: startY },
      { x: startX, y: startY - shortStem },
      { x: startX + outsideSign * shortBreak, y: startY - shortStem },
    ];
  }

  if (routeId === "slant") {
    return [
      { x: startX, y: startY },
      {
        x: startX + insideSign * mediumBreak,
        y: startY - mediumStem,
      },
    ];
  }

  if (routeId === "comeback") {
    return [
      { x: startX, y: startY },
      { x: startX, y: startY - deepStem },
      {
        x: startX + insideSign * shortBreak,
        y: startY - deepStem + shortStem * 0.45,
      },
    ];
  }

  if (routeId === "curl") {
    return [
      { x: startX, y: startY },
      { x: startX, y: startY - mediumStem },
      { x: startX, y: startY - mediumStem + shortStem * 0.45 },
    ];
  }

  if (routeId === "square-out") {
    return [
      { x: startX, y: startY },
      { x: startX, y: startY - mediumStem },
      { x: startX + outsideSign * mediumBreak, y: startY - mediumStem },
    ];
  }

  if (routeId === "square-in") {
    return [
      { x: startX, y: startY },
      { x: startX, y: startY - mediumStem },
      { x: startX + insideSign * mediumBreak, y: startY - mediumStem },
    ];
  }

  if (routeId === "corner") {
    return [
      { x: startX, y: startY },
      { x: startX, y: startY - mediumStem },
      {
        x: startX + outsideSign * mediumBreak,
        y: startY - deepStem,
      },
    ];
  }

  if (routeId === "post") {
    return [
      { x: startX, y: startY },
      { x: startX, y: startY - mediumStem },
      {
        x: startX + insideSign * mediumBreak,
        y: startY - deepStem,
      },
    ];
  }

  return [
    { x: startX, y: startY },
    { x: startX, y: startY - deepStem - shortStem },
  ];
};
