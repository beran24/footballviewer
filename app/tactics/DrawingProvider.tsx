"use client";

import { createContext, useContext } from "react";

export type DrawingContextValue = {
  isDrawEnabled: boolean;
  onToggleDraw: () => void;
  strokeColor: string;
  onStrokeColorChange: (nextColor: string) => void;
  lineWidth: number;
  onLineWidthChange: (nextWidth: number) => void;
  hasDrawing: boolean;
  onClearDrawing: () => void;
};

const DrawingContext = createContext<DrawingContextValue | null>(null);

export function DrawingProvider({
  value,
  children,
}: {
  value: DrawingContextValue;
  children: React.ReactNode;
}) {
  return (
    <DrawingContext.Provider value={value}>{children}</DrawingContext.Provider>
  );
}

export function useDrawing() {
  const context = useContext(DrawingContext);
  if (!context) {
    throw new Error("useDrawing must be used inside DrawingProvider");
  }

  return context;
}
