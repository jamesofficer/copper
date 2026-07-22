import { type PointerEvent as ReactPointerEvent, useState } from "react";

interface Options {
  storageKey: string;
  min: number;
  max: number;
  fallback: number;
  // Which edge of the panel the drag handle sits on — dragging away from the
  // panel makes it wider.
  handle: "left" | "right";
}

// Width state for a drag-resizable side panel, persisted in localStorage.
export function usePanelWidth({
  storageKey,
  min,
  max,
  fallback,
  handle,
}: Options) {
  const [width, setWidth] = useState(() => {
    const stored = Number(localStorage.getItem(storageKey));
    return stored >= min && stored <= max ? stored : fallback;
  });

  function startResize(event: ReactPointerEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    let latest = startWidth;

    function onMove(move: PointerEvent) {
      const delta =
        handle === "left" ? startX - move.clientX : move.clientX - startX;
      latest = Math.min(max, Math.max(min, startWidth + delta));
      setWidth(latest);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      localStorage.setItem(storageKey, String(latest));
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return { width, startResize };
}
