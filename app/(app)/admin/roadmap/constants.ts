export type RoadmapKind = "feature" | "bug" | "change";
export type RoadmapStatus =
  | "requested"
  | "planned"
  | "building"
  | "on_dev"
  | "live"
  | "declined";
export type RoadmapPriority = "low" | "medium" | "high" | "critical";

export const KIND_LABEL: Record<RoadmapKind, string> = {
  feature: "Feature",
  bug: "Bug",
  change: "Change",
};

export const STATUS_LABEL: Record<RoadmapStatus, string> = {
  requested: "Requested",
  planned: "Planned",
  building: "Building",
  on_dev: "On dev",
  live: "Live",
  declined: "Parked",
};

/** Pipeline order, left to right on the board. */
export const STATUS_ORDER: RoadmapStatus[] = [
  "requested",
  "planned",
  "building",
  "on_dev",
  "live",
  "declined",
];

export const PRIORITY_LABEL: Record<RoadmapPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const KINDS: RoadmapKind[] = ["feature", "bug", "change"];
export const STATUSES: RoadmapStatus[] = [
  "requested",
  "planned",
  "building",
  "on_dev",
  "live",
  "declined",
];
export const PRIORITIES: RoadmapPriority[] = ["low", "medium", "high", "critical"];
