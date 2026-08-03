#!/bin/sh
# In dev the dock shows the bundled Electron.app's own name and icon, so this
# rewrites its Info.plist to "Reviewr", swaps in our icon, and re-signs the
# bundle (an edited plist breaks the ad-hoc signature). Runs on postinstall
# because reinstalling node_modules restores stock Electron.
set -e

APP="node_modules/electron/dist/Electron.app"
[ "$(uname)" = "Darwin" ] || exit 0
[ -d "$APP" ] || exit 0

plutil -replace CFBundleName -string "Reviewr" "$APP/Contents/Info.plist"
plutil -replace CFBundleDisplayName -string "Reviewr" "$APP/Contents/Info.plist"

if [ -f build/icon.icns ]; then
  cp build/icon.icns "$APP/Contents/Resources/electron.icns"
fi

codesign --force --deep --sign - "$APP" 2>/dev/null

# macOS caches a bundle's name in LaunchServices, so the dock keeps saying
# "Electron" no matter what the plist holds. Re-register the real path (the
# node_modules entry is a symlink into the pnpm store) to refresh that record.
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
if [ -x "$LSREGISTER" ]; then
  REAL_APP="$(cd "$APP" && pwd -P)"
  touch "$REAL_APP"
  "$LSREGISTER" -f "$REAL_APP" || true
fi

echo "Branded dev Electron.app as Reviewr"
