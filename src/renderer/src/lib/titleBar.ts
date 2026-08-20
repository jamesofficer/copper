import type { SystemStyleObject } from "@chakra-ui/react";

// macOS hides the system title bar and draws the traffic lights over the app's
// own top bar (see `titleBarStyle` in main/index.ts), so the top bars have to
// leave room for the buttons and act as the window's drag handle. On other
// platforms the window keeps its frame and neither is needed.
export const isMac = navigator.userAgent.includes("Mac");

// Left padding for a top bar: clear of the three buttons at their configured x
// offset on macOS, the usual gutter everywhere else.
export const trafficLightSpace = isMac ? "96px" : "4";

// Height of the app's top bars, so the buttons sit centred in all of them.
export const titleBarHeight = "12";

// Cast because the app-region property belongs to Electron. It is not part of
// the CSS types that Chakra supplies. The name is in camel case. Both spellings
// give the same CSS, but the kebab-case spelling also makes a warning.
export const dragRegion = (
  isMac ? { WebkitAppRegion: "drag" } : {}
) as SystemStyleObject;

// A drag region makes all of its children drag the window, and a click on them
// does nothing. Each control inside a drag region needs this style. The tab bar
// needs it most, because the bar is a drag region that is almost all controls.
export const noDragRegion = (
  isMac ? { WebkitAppRegion: "no-drag" } : {}
) as SystemStyleObject;
