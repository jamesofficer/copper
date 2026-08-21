import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { stubApi } from "../testing/api";
import { renderWithProviders } from "../testing/render";
import {
  startWindowFullscreenTracking,
  useWindowFullscreen,
} from "./windowFullscreen";

describe("window fullscreen state", () => {
  it("follows state changes from Electron", () => {
    let notify: ((fullscreen: boolean) => void) | undefined;
    stubApi({
      isWindowFullscreen: () => false,
      onWindowFullscreenChange: (listener) => {
        notify = listener;
        return () => {
          notify = undefined;
        };
      },
    });
    startWindowFullscreenTracking();
    renderWithProviders(<FullscreenState />);
    expect(screen.getByText("windowed")).toBeTruthy();

    act(() => notify?.(true));

    expect(screen.getByText("fullscreen")).toBeTruthy();
  });
});

function FullscreenState() {
  const fullscreen = useWindowFullscreen();
  return <span>{fullscreen ? "fullscreen" : "windowed"}</span>;
}
