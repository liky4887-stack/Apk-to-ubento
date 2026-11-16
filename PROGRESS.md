# apk2ubuntu — progress

## Goal
Convert APK → runnable Ubuntu app (.deb / AppImage / Flatpak).
Intake via morluto/rea. Execution via ATL.

## Benches
- **Termux** — dev terminal only. Not the toolchain.
- **proot Ubuntu** — REA + JADX native. Primary dev bench now.
- **Ubuntu host / CI** — ATL runtime build. glibc required.

## Walls hit on Termux (documented, solved)
| Wall | Symptom | Fix |
|---|---|---|
| nvm glibc Node | `e_type: 2` | use `pkg nodejs-lts` |
| esbuild scripts | postinstall blocked | `npm approve-scripts esbuild` |
| turbo glibc binary | `e_type: 2` | `pkg install turbo` + swap / env |
| TypeScript 7 native | no `android-arm64` pkg | override to TS 6.0.3 |
| Node heap | `FATAL ERROR` ~1 GB | `NODE_OPTIONS=--max-old-space-size=4096` |
| REA runtime floor | requires 24.22.1 | `scripts/rea-termux.mjs` lie |
| **JADX** | `unsupported_host` android/arm64 | **proot Ubuntu** |

## Current status
- REA builds on Termux ✅ (`dist/` 67 MB, 3399 modules)
- REA CLI runs on Termux ✅ via `scripts/rea-termux.mjs`
- Signature + Flutter intake work ✅
- `inspect-android-package` / `decode-android-resources` blocked by JADX guard ❌
- Next: build REA inside proot Ubuntu, then `atl-launcher.ts`

## Doors
    npm run smoke                        # wiring only
    npm run smoke /path/to/app.apk       # full intake
