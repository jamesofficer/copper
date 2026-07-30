import type { SystemStyleObject } from "@chakra-ui/react";

// The sidebar sits on a darkened background of its own, so its rows can't reuse
// the app's bg.subtle hover — it barely shows there. These overlays are
// relative instead: a touch darker in light mode, a touch lighter in dark, so a
// hovered row always reads as offset from whatever is behind it.
export const sidebarHover: SystemStyleObject = {
  bg: "black/8",
  _dark: { bg: "white/8" },
};

// The selected repository, one step stronger than a hover.
export const sidebarSelected: SystemStyleObject = {
  bg: "black/12",
  _dark: { bg: "white/14" },
};
