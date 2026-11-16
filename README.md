# apk2ubuntu

APK → Ubuntu app. Intake via morluto/rea, execution via ATL, packaging as .deb/AppImage/Flatpak.

## Doors
- **Termux bench** — apk2ubuntu CLI, packaging, REA intake.
- **Ubuntu bench** — ATL runtime. Must be built on glibc. Never on Termux.

## Quick start
    npm run smoke                        # wiring only, no APK
    npm run smoke /path/to/app.apk       # full intake

## Bridge
src/intake/rea-bridge.ts shells to ~/rea/scripts/rea-termux.mjs with --format json.
