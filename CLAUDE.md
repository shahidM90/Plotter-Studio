# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Plotter Studio is a desktop application that transforms Bambu Lab 3D printers into precision pen plotters. Users design or import content (text, images, SVGs, QR codes, patterns, shapes, freehand drawing), arrange it on a virtual printer bed, and export G-code that moves a Bambu Lab printer's toolhead with a pen attached across paper.

Version: **1.0.0** (first public release)

## Commands

```bash
npm run dev           # Vite dev server (frontend only, hot reload)
npm run server        # Express backend (printer API on port 5426)
npm run build         # Production Vite build → dist/
npm run dist          # Build + Windows NSIS installer → release/
npm run electron:dev  # Electron app in dev mode (Vite + Electron concurrently)
npm run electron:start # Build then launch Electron (production simulation)
npm start             # CLI: build + server in one process
npm run lint          # ESLint (flat config)
npm run preview       # Vite preview of production build
```

### Development workflows

**Electron (recommended):** `npm run electron:dev` starts Vite and Electron concurrently. Frontend hot-reloads; restart Electron for backend changes.

**Web-only:** Two terminals — `npm run dev` in one, `npm run server` in the other. Frontend at `http://localhost:5173`, backend at `http://127.0.0.1:5426`.

There are **no tests** in this project.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Electron Shell                  │
│  ┌───────────────────────────────────────────┐  │
│  │            React Frontend (SPA)            │  │
│  │     Design tools, layer system, preview    │  │
│  └──────────────────┬────────────────────────┘  │
│                     │   HTTP REST                 │
│  ┌──────────────────▼────────────────────────┐  │
│  │           Express Backend (:5426)          │  │
│  │  G-code validation, printer API, SSDP     │  │
│  └──────┬──────────────┬─────────────────────┘  │
│         │ MQTT (8883)  │ FTP (990)               │
│  ┌──────▼──────────────▼─────────────────────┐  │
│  │          Bambu Lab Printer                │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

The entire app is served from a single Express process. The backend is the **sole bridge** to the printer: REST API calls from the browser are translated into MQTT commands (port 8883, mTLS, username `bblp`) and FTP file uploads (port 990). SSDP printer discovery uses raw UDP datagrams on ports 1900 and 2021.

## Key files

| File | Role |
|---|---|
| `src/App.jsx` | Entire frontend (~2550 lines). All state, all 7 modes (text/photos/qr/patterns/draw/calibrate/shapes), layer management, G-code generation, SVG export, and printer control panel. |
| `src/App.css` | All styles (~800 lines). Dark theme, CSS Grid layout, no framework. |
| `server/index.js` | Express backend (~760 lines). REST API, MQTT client, FTP upload, SSDP discovery, G-code validation. |
| `electron/main.js` | Electron main process. Creates BrowserWindow, starts Express backend internally, loads app URL. |
| `electron/preload.js` | Minimal preload script exposing platform and isElectron flag via contextBridge. |
| `bin/plotterstudio.js` | CLI entry point. Parses `--port` / `--no-open`, sets env vars, imports the server. |

## Electron integration

- **main.js** starts the Express backend (`startServer`) before creating the BrowserWindow
- In dev mode, the window loads from `VITE_DEV_SERVER_URL`; in production, from `http://127.0.0.1:{PORT}`
- `app.setAppUserModelId('com.plotterstudio.app')` ensures proper Windows taskbar integration
- Native menu bar is removed (`Menu.setApplicationMenu(null)`)
- `ready-to-show` event prevents white flash on startup
- External links open in the system browser via `shell.openExternal`
- DevTools only open in dev mode (`app.isPackaged` check)
- Icon loaded from `process.resourcesPath` in production, `build/` in dev

## Windows installer

- **electron-builder** with **NSIS** target produces `Plotter Studio Setup.exe`
- `npm run dist` builds the frontend then runs electron-builder
- Installer: non-one-click, allows install directory selection, creates desktop + Start menu shortcuts
- `signAndEditExecutable: false` — unsigned build (no code signing certificate)
- App files are unpacked (`asar: false`) because `server/index.js` reads `package.json` at runtime
- `extraResources` copies `build/icon-256.png` → `resources/icon.png` for the window icon
- Output directory: `release/`

## Coordinate system

**All design coordinates are in millimeters** on a 2D plane representing the printer bed.

### Screen-to-SVG coordinate conversion

There are two approaches in the codebase:

- **`accurateSvgPoint(event)`** — uses `getScreenCTM().inverse()` via `svg.createSVGPoint()`. This is the **correct** method that accounts for all CSS transforms, scaling, and SVG `preserveAspectRatio` letterboxing. Used by: shapes (create/drag/scale/rotate), tap-to-move, draw mode (both pointerdown and pointermove).

- **`svgPointFromEvent(event)`** — rect-based math: `(clientX - rect.left) / rect.width * bedWidth`. This is fast but does NOT account for SVG letterboxing, causing misalignment between cursor and rendered stroke. **Only used as a fallback** when `getScreenCTM()` returns null.

**Rule: always prefer `accurateSvgPoint` for new features.** The draw mode was migrated from `svgPointFromEvent` to `accurateSvgPoint` in v1.0.0 to fix pointer alignment issues.

### Formatting helpers

- **`formatMM(v)`** — `Number(v.toFixed(2))` — 2 decimal places for shapes, paper dimensions, text coordinates
- **`formatBedSize(v)`** — `Math.round(v)` — integer display for bed dimensions, origin, park positions
- Both are **display-only** — internal state retains full precision

## Shape system (v1.0.0)

The shapes mode was redesigned with a full interaction model:

- **`activeTool`** state: `'none'` | `'circle'` | `'rect'` | `'star'` | `'line'` | `'hexagon'`
- `'none'` = selection/edit mode (default); any shape type = placement mode
- **Toggle behavior**: clicking an active tool deactivates it (returns to `'none'`)
- **Drag-to-create**: pointerdown records mm start via `accurateSvgPoint`, pointermove shows live `tempShape` preview, pointerup finalizes and auto-selects the shape
- **Interaction layer**: transparent `<rect>` with `pointerEvents: 'all'` as topmost SVG child during placement, ensuring clicks reach the shape creation handler
- **Cursor feedback**: `cursor: crosshair` via CSS class `build-plate-shape-place` when in placement mode
- **SVG icon palette**: 5 toggle buttons (circle/rect/star/line/hexagon) in a 5-column grid, no "select" button needed
- **Shape editing**: move, scale (corner handles), rotate (dedicated handle) when selected in `'none'` mode
- **`computeDragShape(type, start, pt)`**: all-mm drag computation for all 5 shape types
- **`shapeBoundingBox(shape)`** and **`shapeToPaths(shape)`**: geometry utilities used for rendering and G-code

## Tap-to-move

- Activated via "Tap to Move" button (only when printer is connected)
- Z travel height fixed at **1mm** above Z=0 (hardcoded, not configurable)
- Uses `accurateSvgPoint` for precise coordinate mapping
- G-code sequence: `G90` → `G0 Z1` → `M400` → `G0 X Y`
- Visual feedback: amber crosshair marker at tap location (fades after 1.5s)

## Calibration

- **Centered on bed**: `makeCalibrationPaths` centers the 50x50mm pattern at `(bedWidth/2, bedHeight/2)`
- Pattern: square outline, diagonals, center crosshairs, offset crosshair
- No longer anchored to paper origin — always centered regardless of bed size

## Draw mode

- All draw points use `accurateSvgPoint` (fixed in v1.0.0)
- `requestAnimationFrame` throttling for smooth rendering
- Path simplification: `DRAW_MIN_DISTANCE_MM` minimum distance between points
- `DRAW_MAX_POINTS_PER_STROKE` cap per stroke

## Important patterns

**Single-file frontend.** There is no component decomposition — all React state, all 7 modes, layer management, G-code generation, SVG export, and the printer control panel live in `src/App.jsx`. State is managed entirely with `useState` and `useMemo` hooks. No routing, no external state library.

**G-code safety is enforced on both client and server.** Only a whitelist of G/M-codes is allowed: G0, G1, G4, G21, G28, G90, G91, G92, M2, M17, M18, M84, M104 S0, M107, M140 S0, M221 S0/S100, M400. Commands that could heat the nozzle/bed or move the extruder are blocked. Both `src/App.jsx` and `server/index.js` contain validation logic that must stay in sync.

**Printer movement endpoints.** Two distinct endpoints handle toolhead movement:
- `POST /api/printer/jog` — relative moves (`G91 G0`), capped at 50mm per axis. Used by the on-screen jog pad buttons.
- `POST /api/printer/move-absolute` — absolute moves (`G90 G0`), no distance cap. Used by "Tap to Move". Lifts Z to 1mm before XY travel with `M400` synchronization.

**Layer system.** Multiple designs stack as layers with independent colors, visibility toggles, and Z-order. The `buildPlotGCode()` function iterates layers in order, producing a single G-code file with tool changes (manual pen swaps) between layers of different colors.

**Hershey font system has two code paths.** A legacy hand-coded font table (`HERSHEY` const) defines A-Z, 0-9, and punctuation as stroke coordinates directly in the file. Real Hershey fonts come from the `hersheytext` npm package. The `isLegacyFont()` helper determines which rendering path to use.

**Image tracing pipeline.** Raster images are loaded, drawn to an offscreen canvas, sampled for pixel data, then converted to vector paths using the selected algorithm (connected outline, fine outline, threshold outline, sketch, hatching, stipple). The `tracePixelsToShapes()` function dispatches to the correct tracing mode.

**Printer type coupling.** Only `bedWidth`/`bedHeight` changes set the preset to `'custom'`. Paper dimension changes (via inputs or drag handles) do NOT affect the preset.

## Environment variables

| Variable | Purpose |
|---|---|
| `VITE_PRINTER_API_URL` | Backend URL the frontend calls (default: `http://127.0.0.1:5426`) |
| `PLOTTER_SERVER_PORT` | Server listen port (default: `5426`) |
| `PLOTTER_SERVER_HOST` | Server bind address (default: `127.0.0.1`) |
| `PLOTTER_OPEN_BROWSER` | Auto-open browser on start (`1` or `0`) |
| `PLOTTER_STATIC_DIR` | Directory for static file serving (default: `dist/`) |
| `VITE_DEV_SERVER_URL` | Set by electron:dev to point Electron at the Vite dev server |

## Release history

| Version | Notes |
|---|---|
| **1.0.0** | First public release. Desktop app with Electron + NSIS installer. Shape tools with drag-to-create, tap-to-move, calibration centering, draw mode precision fix, formatting system. |
| 0.1.6 | Pre-release. Auto-update spawn fix on Windows. |
| 0.1.5 | Pre-release. Tap-to-move feature added. |
| 0.1.4 | Pre-release. Initial shapes mode, README refresh. |

## Constraints

- No external UI libraries — all components are hand-written
- No state management library — all `useState`/`useMemo`
- No router — single-page app with mode-based rendering
- No tests — verify changes via `npm run build` and manual testing
- No refactoring of `App.jsx` into components (maintain single-file pattern)
- Backend must remain the sole bridge to the printer (MQTT + FTP)
- G-code whitelist must stay in sync between client and server
- Coordinate system in mm, never pixels
