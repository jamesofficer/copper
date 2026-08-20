import { formatForDisplay } from "@tanstack/react-hotkeys";

// The app's keyboard shortcuts, in TanStack Hotkeys' notation. "Mod" resolves
// to Command on macOS and Control everywhere else, so one string covers both.
export const hotkeys = {
  toggleSidebar: "Mod+B",
  previousIssue: "ArrowLeft",
  nextIssue: "ArrowRight",
  closeTab: "Mod+W",
  // Control and not Mod on all platforms. Browsers and editors use Control+Tab
  // on macOS as well, and Command+Tab belongs to the operating system.
  nextTab: "Control+Tab",
  previousTab: "Control+Shift+Tab",
} as const;

// Cmd+1 to Cmd+9 select a tab by its position. The list holds each shortcut
// one by one, and not a function that builds them. The library needs a text
// value that it knows at compile time. The position of a shortcut in this list
// is also the position of its tab, and the store counts those from 0.
export const tabIndexHotkeys = [
  "Mod+1",
  "Mod+2",
  "Mod+3",
  "Mod+4",
  "Mod+5",
  "Mod+6",
  "Mod+7",
  "Mod+8",
  "Mod+9",
] as const;

// How a shortcut reads in a button's tooltip — "⌘ B" on macOS, "Ctrl+B" on
// Windows and Linux, picked by the library from the platform.
export function hotkeyHint(hotkey: string): string {
  return formatForDisplay(hotkey);
}
