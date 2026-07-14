import { join } from "node:path";
import { app, BrowserWindow, shell } from "electron";
import { registerIpcHandlers } from "./ipc/router";

function openExternal(url: string): void {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    void shell.openExternal(url);
  }
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
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
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
