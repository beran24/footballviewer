import type { DefenseCoverageId, NearZoneCount } from "../types";

export type DefenseCoverageOption = {
  id: DefenseCoverageId;
  label: string;
};

export type CoverageZoneRect = {
  leftPercent: number;
  topOffsetFromLosPercent: number;
  widthPercent: number;
  heightPercent: number;
  label: string;
};

export type NearZoneCountOption = {
  id: NearZoneCount;
  label: string;
};

export const defenseCoverageOptions: DefenseCoverageOption[] = [
  { id: "none", label: "None" },
  { id: "cover-0", label: "Cover 0" },
  { id: "cover-1", label: "Cover 1" },
  { id: "cover-2", label: "Cover 2" },
  { id: "cover-3", label: "Cover 3" },
  { id: "cover-4", label: "Cover 4" },
  { id: "cover-6", label: "Cover 6" },
  { id: "palms", label: "Palms (Cover 2 Read)" },
];

export const nearZoneCountOptions: NearZoneCountOption[] = [
  { id: 3, label: "3 near zones" },
  { id: 4, label: "4 near zones" },
  { id: 5, label: "5 near zones" },
];

const buildNearZones = (
  nearZoneCount: NearZoneCount,
  nearHeightPercent: number,
): CoverageZoneRect[] => {
  if (nearZoneCount === 3) {
    return [
      {
        leftPercent: 0,
        topOffsetFromLosPercent: 0,
        widthPercent: 30,
        heightPercent: nearHeightPercent,
        label: "Curl to Flat L",
      },
      {
        leftPercent: 30,
        topOffsetFromLosPercent: 0,
        widthPercent: 40,
        heightPercent: nearHeightPercent,
        label: "Middle",
      },
      {
        leftPercent: 70,
        topOffsetFromLosPercent: 0,
        widthPercent: 30,
        heightPercent: nearHeightPercent,
        label: "Curl to Flat R",
      },
    ];
  }

  if (nearZoneCount === 5) {
    return [
      {
        leftPercent: 0,
        topOffsetFromLosPercent: 0,
        widthPercent: 18,
        heightPercent: nearHeightPercent,
        label: "Flat L",
      },
      {
        leftPercent: 18,
        topOffsetFromLosPercent: 0,
        widthPercent: 22,
        heightPercent: nearHeightPercent,
        label: "Curl L",
      },
      {
        leftPercent: 40,
        topOffsetFromLosPercent: 0,
        widthPercent: 20,
        heightPercent: nearHeightPercent,
        label: "Middle",
      },
      {
        leftPercent: 60,
        topOffsetFromLosPercent: 0,
        widthPercent: 22,
        heightPercent: nearHeightPercent,
        label: "Curl R",
      },
      {
        leftPercent: 82,
        topOffsetFromLosPercent: 0,
        widthPercent: 18,
        heightPercent: nearHeightPercent,
        label: "Flat R",
      },
    ];
  }

  return [
    {
      leftPercent: 0,
      topOffsetFromLosPercent: 0,
      widthPercent: 25,
      heightPercent: nearHeightPercent,
      label: "Flat L",
    },
    {
      leftPercent: 25,
      topOffsetFromLosPercent: 0,
      widthPercent: 25,
      heightPercent: nearHeightPercent,
      label: "Curl L",
    },
    {
      leftPercent: 50,
      topOffsetFromLosPercent: 0,
      widthPercent: 25,
      heightPercent: nearHeightPercent,
      label: "Curl R",
    },
    {
      leftPercent: 75,
      topOffsetFromLosPercent: 0,
      widthPercent: 25,
      heightPercent: nearHeightPercent,
      label: "Flat R",
    },
  ];
};

const coverageZonesById: Record<DefenseCoverageId, CoverageZoneRect[]> = {
  none: [],
  "cover-0": [],
  "cover-1": [
    {
      leftPercent: 0,
      topOffsetFromLosPercent: 22,
      widthPercent: 100,
      heightPercent: 22,
      label: "Deep",
    },
  ],
  "cover-2": [
    {
      leftPercent: 0,
      topOffsetFromLosPercent: 22,
      widthPercent: 50,
      heightPercent: 22,
      label: "Deep 1/2 L",
    },
    {
      leftPercent: 50,
      topOffsetFromLosPercent: 22,
      widthPercent: 50,
      heightPercent: 22,
      label: "Deep 1/2 R",
    },
  ],
  "cover-3": [
    {
      leftPercent: 0,
      topOffsetFromLosPercent: 22,
      widthPercent: 33.34,
      heightPercent: 22,
      label: "Deep 1/3 L",
    },
    {
      leftPercent: 33.33,
      topOffsetFromLosPercent: 22,
      widthPercent: 33.34,
      heightPercent: 22,
      label: "Deep 1/3 M",
    },
    {
      leftPercent: 66.66,
      topOffsetFromLosPercent: 22,
      widthPercent: 33.34,
      heightPercent: 22,
      label: "Deep 1/3 R",
    },
  ],
  "cover-4": [
    {
      leftPercent: 0,
      topOffsetFromLosPercent: 20,
      widthPercent: 25,
      heightPercent: 20,
      label: "Deep 1/4 L",
    },
    {
      leftPercent: 25,
      topOffsetFromLosPercent: 20,
      widthPercent: 25,
      heightPercent: 20,
      label: "Deep 1/4 LM",
    },
    {
      leftPercent: 50,
      topOffsetFromLosPercent: 20,
      widthPercent: 25,
      heightPercent: 20,
      label: "Deep 1/4 RM",
    },
    {
      leftPercent: 75,
      topOffsetFromLosPercent: 20,
      widthPercent: 25,
      heightPercent: 20,
      label: "Deep 1/4 R",
    },
  ],
  "cover-6": [
    {
      leftPercent: 0,
      topOffsetFromLosPercent: 22,
      widthPercent: 50,
      heightPercent: 22,
      label: "Deep 1/2 L",
    },
    {
      leftPercent: 50,
      topOffsetFromLosPercent: 22,
      widthPercent: 25,
      heightPercent: 22,
      label: "Deep 1/4 RM",
    },
    {
      leftPercent: 75,
      topOffsetFromLosPercent: 22,
      widthPercent: 25,
      heightPercent: 22,
      label: "Deep 1/4 R",
    },
  ],
  palms: [
    {
      leftPercent: 0,
      topOffsetFromLosPercent: 0,
      widthPercent: 25,
      heightPercent: 0,
      label: "Deep 1/4 R",
    },
    {
      leftPercent: 25,
      topOffsetFromLosPercent: 0,
      widthPercent: 25,
      heightPercent: 0,
      label: "Deep 1/4 RM",
    },
    {
      leftPercent: 50,
      topOffsetFromLosPercent: 0,
      widthPercent: 25,
      heightPercent: 0,
      label: "Deep 1/4 LM",
    },
    {
      leftPercent: 75,
      topOffsetFromLosPercent: 0,
      widthPercent: 25,
      heightPercent: 0,
      label: "Deep 1/4 L",
    },
  ],
};

const coveragesWithNearZones = new Set<DefenseCoverageId>([
  "cover-2",
  "cover-3",
  "cover-4",
  "cover-6",
]);

export const getDefenseCoverageZones = (
  coverage: DefenseCoverageId,
  nearZoneCount: NearZoneCount,
): CoverageZoneRect[] => {
  const baseZones = coverageZonesById[coverage] ?? coverageZonesById.none;
  if (!coveragesWithNearZones.has(coverage)) {
    return baseZones;
  }

  const deepZones = baseZones.filter((zone) =>
    zone.label.toLowerCase().startsWith("deep"),
  );
  const nearHeightPercent = deepZones[0]?.topOffsetFromLosPercent ?? 22;
  return [...deepZones, ...buildNearZones(nearZoneCount, nearHeightPercent)];
};
