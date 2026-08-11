#!/bin/sh
# In dev the dock shows the bundled Electron.app's own name and icon, so this
# rewrites its Info.plist to "Copper", swaps in our icon, and re-signs the
# bundle (an edited plist breaks the ad-hoc signature). Runs on postinstall
# because reinstalling node_modules restores stock Electron.
set -e

APP="node_modules/electron/dist/Electron.app"
[ "$(uname)" = "Darwin" ] || exit 0
[ -d "$APP" ] || exit 0

plutil -replace CFBundleName -string "Copper" "$APP/Contents/Info.plist"
plutil -replace CFBundleDisplayName -string "Copper" "$APP/Contents/Info.plist"

# The dock tile's tooltip shows the running process's name, which is the
# executable's filename — not CFBundleName — so it says "Electron" however the
# plist reads. Rename the binary and point the bundle at it, plus the electron
# package's path.txt, which is how electron-vite finds the binary to spawn.
# path.txt is read raw with no trim, so it gets no trailing newline.
if [ -f "$APP/Contents/MacOS/Electron" ]; then
  mv "$APP/Contents/MacOS/Electron" "$APP/Contents/MacOS/Copper"
fi
plutil -replace CFBundleExecutable -string "Copper" "$APP/Contents/Info.plist"
printf 'Electron.app/Contents/MacOS/Copper' > node_modules/electron/path.txt

# Stock Electron ships CFBundleIdentifier com.github.Electron, which every
# other Electron app's dev build on the machine also claims. LaunchServices
# resolves a running app's name by identifier, so with several bundles sharing
# one it can answer with somebody else's record and the dock says "Electron"
# however this plist reads. A private identifier gives us our own record.
plutil -replace CFBundleIdentifier -string "com.jamesofficer.copper.dev" \
  "$APP/Contents/Info.plist"

if [ -f build/icon.icns ]; then
  cp build/icon.icns "$APP/Contents/Resources/electron.icns"
fi

codesign --force --deep --sign - "$APP" 2>/dev/null

# macOS caches a bundle's name in LaunchServices, so the dock keeps saying
# "Electron" no matter what the plist holds. Drop the stale record before
# re-registering the real path (the node_modules entry is a symlink into the
# pnpm store) so the cache can't survive the rename.
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
if [ -x "$LSREGISTER" ]; then
  REAL_APP="$(cd "$APP" && pwd -P)"
  "$LSREGISTER" -u "$REAL_APP" 2>/dev/null || true
  touch "$REAL_APP"
  "$LSREGISTER" -f "$REAL_APP" || true
fi

echo "Branded dev Electron.app as Copper"
