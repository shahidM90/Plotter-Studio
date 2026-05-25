# Plotter Studio

Turn your Bambu Lab 3D printer into a pen plotter. Design, trace, and draw — all from your browser.

Plotter Studio is a browser-based pen plotter G-code generator and printer controller. Create text, trace images, import SVGs, generate QR codes, or draw freehand — layer them together with independent colors, then send G-code directly to your printer over Wi-Fi. No filament, no slicing, just pen on paper.

## Supported Printers

- Bambu Lab A1
- Bambu Lab A1 mini
- Bambu Lab X1 Carbon
- Bambu Lab P1S
- Custom (any Bambu Lab printer reachable over LAN)

## Features

**Design Tools**
- **Hershey vector text** — stroke-based fonts with multi-text-block support and rotation
- **Image tracing** — six modes: connected outline, fine outline, threshold outline, sketch, hatching, and stipple
- **SVG import** — import paths, shapes, and text from SVG files
- **QR code generator** — square, rounded, or dot module styles with fill-line support
- **Generative patterns** — hatching, crosshatch, diagonal, spiral, flow lines, and contour fills
- **Freehand drawing** — draw directly on the virtual bed with automatic path simplification

**Printer Control**
- **Tap to Move** — click anywhere on the virtual bed to position the toolhead over that exact spot
- **XY jog pad** and **Z jog** — fine-tune pen height and position from your browser
- **Z-zero calibration** — set your pen height once and preserve it across jobs
- **Toolhead fan control** — lightweight pen-lift mechanism using the part cooling fan
- **Pause / Resume / Stop** — live control during a plot
- **Send G-code** — stream line-by-line or upload via FTP directly to the printer

**Workflow**
- **Layer system** — stack multiple designs with independent colors, visibility, and ordering
- **Multi-color support** — automatic tool-change pauses between colors for manual pen swaps
- **Playback preview** — animated stroke-by-stroke preview before you plot
- **Export** — download as SVG or G-code file

**Safety & Quality**
- Whitelist-based G-code validation (blocks heater and extruder commands)
- Safety confirmation gates before every print
- Preserve Z-zero mode to keep your calibrated pen height across jobs

## Install

### Windows (recommended)

Requirements: Node.js 20 or newer.

Download and unzip the project, then run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
```

This installs dependencies, builds the app, and creates a **Plotter Studio** desktop shortcut. Open the shortcut anytime to start the server and launch the app.

### From GitHub (any platform)

```bash
npm install -g git+https://github.com/shahidM90/Plotter-Studio.git --install-links
plotterstudio server
```

Or:

```bash
plotter-studio server
```

The server starts at `http://127.0.0.1:5426` and opens the app in your browser.

Options:

```bash
plotterstudio server --port 3000 --no-open
```

## Development

```bash
npm install
```

In one terminal, start the Vite dev server (hot-reload frontend):

```bash
npm run dev
```

In a second terminal, start the printer backend:

```bash
npm run server
```

The frontend runs on Vite at `http://localhost:5173` and connects to the backend at `http://127.0.0.1:5426`.

## How It Works

1. **Design** — pick a mode (text, photos, QR, patterns, or draw) and create your content on the virtual bed. Add layers for multi-color designs.
2. **Calibrate** — set your pen height with the jog controls and calibrate Z-zero. Use Tap to Move to position the toolhead precisely.
3. **Slice & Send** — preflight validates your G-code, then send it to the printer. Watch the playback preview to see your plot stroke by stroke.
4. **Plot** — the printer draws your design on paper with a pen attached to the toolhead. Swap pens between color layers when prompted.
