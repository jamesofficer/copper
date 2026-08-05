import { existsSync } from "node:fs";
import { join } from "node:path";
import { app, BrowserWindow, nativeImage, shell } from "electron";
import { handleAssetRequests, registerAssetScheme } from "./github/assets";
import { registerIpcHandlers } from "./ipc/router";

// Pin the name rather than leaving it to whatever bundle we happen to run
// under: it titles the macOS app menu, and safeStorage keys its keychain item
// by it, so a dev build with an unbranded Electron.app (a git worktree that
// hasn't run postinstall) would otherwise encrypt secrets under a second name.
// Must run before the app is ready, since it also fixes the userData path.
app.setName("Copper");

// Privileged schemes must be declared before the app is ready.
registerAssetScheme();

function setDockIcon(): void {
  if (process.platform !== "darwin" || !app.dock) return;
  const iconPath = join(app.getAppPath(), "resources", "icon.png");
  if (existsSync(iconPath)) {
    app.dock.setIcon(nativeImage.createFromPath(iconPath));
  }
}

function openExternal(url: string): void {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    void shell.openExternal(url);
  }
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    // No system title bar on macOS — the app draws its own top bar and the
    // traffic lights sit inside it. The renderer leaves room for them and
    // marks those bars as drag regions.
    ...(process.platform === "darwin"
      ? {
          titleBarStyle: "hidden" as const,
          trafficLightPosition: { x: 18, y: 18 },
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
    },
  });

  // Keep external links in the system browser instead of navigating the app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== window.webContents.getURL()) {
      event.preventDefault();
      openExternal(url);
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

void app.whenReady().then(() => {
  setDockIcon();
  registerIpcHandlers();
  handleAssetRequests();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
