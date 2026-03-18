import type { RouteId } from "../types";

export type RouteOption = {
  id: RouteId;
  label: string;
};

export const routeOptions: RouteOption[] = [
  { id: "quick-out", label: "Quick Out" },
  { id: "slant", label: "Slant" },
  { id: "comeback", label: "Comeback" },
  { id: "curl", label: "Curl" },
  { id: "square-out", label: "Square Out" },
  { id: "square-in", label: "Square In" },
  { id: "corner", label: "Corner" },
  { id: "post", label: "Post" },
  { id: "go", label: "Go" },
];
