import { IconButton } from "@chakra-ui/react";
import { LuPanelLeftOpen } from "react-icons/lu";
import {
  setSidebarCollapsed,
  useSidebarCollapsed,
} from "../lib/sidebarCollapsed";

// Brings the sidebar back. Lives in each screen's top bar, because the button
// that hides the sidebar goes away with it.
export default function ShowSidebarButton() {
  const collapsed = useSidebarCollapsed();
  if (!collapsed) return null;

  return (
    <IconButton
      aria-label="Show sidebar"
      title="Show sidebar"
      size="xs"
      variant="ghost"
      color="fg.muted"
      onClick={() => setSidebarCollapsed(false)}
    >
      <LuPanelLeftOpen />
    </IconButton>
  );
}
