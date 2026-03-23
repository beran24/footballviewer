import type { PointerEvent } from "react";
import type {
  RouteOverlay,
  DefensePlayerEllipseOverlay,
  DefenseAssignmentOverlay,
  OffenseCustomRouteOverlay,
} from "../utils/overlays";

type FieldOverlaySVGProps = {
  surfaceSize: { width: number; height: number };
  defensePlayerEllipseOverlays: DefensePlayerEllipseOverlay[];
  defenseAssignmentOverlays: DefenseAssignmentOverlay[];
  offenseCustomRouteOverlays: OffenseCustomRouteOverlay[];
  routeOverlays: RouteOverlay[];
  selectedOffenseRoutePlayerId: string | null;
  isDrawEnabled: boolean;
  handleRouteTipPointerDown: (
    playerId: string,
  ) => (e: PointerEvent<HTMLDivElement>) => void;
  handleRouteTipPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  handleRouteTipPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
  handleRouteBreakPointerDown: (
    playerId: string,
  ) => (e: PointerEvent<HTMLDivElement>) => void;
  handleRouteBreakPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  handleRouteBreakPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
};

export function FieldOverlaySVG({
  surfaceSize,
  defensePlayerEllipseOverlays,
  defenseAssignmentOverlays,
  offenseCustomRouteOverlays,
  routeOverlays,
  selectedOffenseRoutePlayerId,
  isDrawEnabled,
  handleRouteTipPointerDown,
  handleRouteTipPointerMove,
  handleRouteTipPointerUp,
  handleRouteBreakPointerDown,
  handleRouteBreakPointerMove,
  handleRouteBreakPointerUp,
}: FieldOverlaySVGProps) {
  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 z-[40]"
        aria-hidden
        width={surfaceSize.width}
        height={surfaceSize.height}
        viewBox={`0 0 ${surfaceSize.width} ${surfaceSize.height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <marker
            id="route-arrow-black"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#000000" />
          </marker>
          <marker
            id="offense-custom-route-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#000000" />
          </marker>
          <marker
            id="defense-assignment-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#b67bff" />
          </marker>
        </defs>

        {defensePlayerEllipseOverlays.map((ellipse) => (
          <ellipse
            key={`defense-player-ellipse-${ellipse.defensePlayerId}`}
            cx={ellipse.cx}
            cy={ellipse.cy}
            rx={ellipse.rx}
            ry={ellipse.ry}
            transform={`rotate(${ellipse.rotation}, ${ellipse.cx}, ${ellipse.cy})`}
            fill="none"
            stroke="#ff9900"
            strokeWidth={2}
            strokeDasharray="6 3"
            opacity={0.8}
          />
        ))}

        {defenseAssignmentOverlays.map((assignment) => (
          <line
            key={`defense-assignment-${assignment.playerId}`}
            x1={assignment.startX}
            y1={assignment.startY}
            x2={assignment.endX}
            y2={assignment.endY}
            stroke="#b67bff"
            strokeWidth={3}
            strokeLinecap="round"
            markerEnd="url(#defense-assignment-arrow)"
          />
        ))}

        {offenseCustomRouteOverlays.map((route) => (
          <g key={`offense-custom-route-${route.playerId}`}>
            {route.isPullBlock && route.pathData ? (
              <path
                d={route.pathData}
                fill="none"
                stroke="#000000"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <line
                x1={route.startX}
                y1={route.startY}
                x2={route.endX}
                y2={route.endY}
                stroke="#000000"
                strokeWidth={3}
                strokeLinecap="round"
                markerEnd={
                  route.isEligible
                    ? "url(#offense-custom-route-arrow)"
                    : undefined
                }
              />
            )}
            {!route.isEligible &&
            route.capStartX !== null &&
            route.capStartY !== null &&
            route.capEndX !== null &&
            route.capEndY !== null ? (
              <line
                x1={route.capStartX}
                y1={route.capStartY}
                x2={route.capEndX}
                y2={route.capEndY}
                stroke="#000000"
                strokeWidth={3}
                strokeLinecap="round"
              />
            ) : null}
          </g>
        ))}

        {routeOverlays.map((route) => (
          <polyline
            key={`route-${route.id}`}
            points={route.points
              .map((point) => `${point.x},${point.y}`)
              .join(" ")}
            fill="none"
            stroke="#000000"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd="url(#route-arrow-black)"
          />
        ))}
      </svg>

      {routeOverlays
        .filter((route) => route.id === selectedOffenseRoutePlayerId)
        .map((route) => (
          <div
            key={`route-tip-${route.id}`}
            className={`absolute z-[45] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-black ${isDrawEnabled ? "pointer-events-none" : "pointer-events-auto cursor-grab active:cursor-grabbing"}`}
            style={{
              left: `${route.tip.x}px`,
              top: `${route.tip.y}px`,
            }}
            onPointerDown={handleRouteTipPointerDown(route.id)}
            onPointerMove={handleRouteTipPointerMove}
            onPointerUp={handleRouteTipPointerUp}
            onPointerCancel={handleRouteTipPointerUp}
            onPointerLeave={handleRouteTipPointerUp}
            title="Drag route tip"
          />
        ))}

      {routeOverlays
        .filter(
          (route) =>
            route.id === selectedOffenseRoutePlayerId && route.breakPoint,
        )
        .map((route) => (
          <div
            key={`route-break-${route.id}`}
            className={`absolute z-[45] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white bg-black ${isDrawEnabled ? "pointer-events-none" : "pointer-events-auto cursor-grab active:cursor-grabbing"}`}
            style={{
              left: `${route.breakPoint!.x}px`,
              top: `${route.breakPoint!.y}px`,
            }}
            onPointerDown={handleRouteBreakPointerDown(route.id)}
            onPointerMove={handleRouteBreakPointerMove}
            onPointerUp={handleRouteBreakPointerUp}
            onPointerCancel={handleRouteBreakPointerUp}
            onPointerLeave={handleRouteBreakPointerUp}
            title="Drag route break point"
          />
        ))}
    </>
  );
}
