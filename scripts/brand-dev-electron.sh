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
echo "Branded dev Electron.app as Reviewr"
