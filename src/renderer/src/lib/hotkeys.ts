import { formatForDisplay } from "@tanstack/react-hotkeys";

// The app's keyboard shortcuts, in TanStack Hotkeys' notation. "Mod" resolves
// to Command on macOS and Control everywhere else, so one string covers both.
export const hotkeys = {
  toggleSidebar: "Mod+B",
} as const;

// How a shortcut reads in a button's tooltip — "⌘ B" on macOS, "Ctrl+B" on
// Windows and Linux, picked by the library from the platform.
export function hotkeyHint(hotkey: string): string {
  return formatForDisplay(hotkey);
}
