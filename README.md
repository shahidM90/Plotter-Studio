# Plotter Studio

Bambu Lab 3D printer plotter conversion.

Browser-based pen plotter G-code generator and Bambu Lab printer controller.

## Install From A Download

Requirements:

- Node.js 20 or newer
- Windows PowerShell

Download and unzip the project, then run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
```

This installs dependencies, builds the web app, and creates a `Plotter Studio` desktop shortcut. Opening the shortcut starts the local server and opens the web app automatically.

## Install From GitHub

```bash
npm install -g git+https://github.com/shahidM90/Plotter-Studio.git --install-links
plotterstudio server
```

You can also use:

```bash
plotter-studio server
```

The command starts the local printer backend, serves the web app, and opens it in your browser.

## Development

```bash
npm install
npm run dev
```

In a second terminal, start the printer backend:

```bash
npm run server
```

The app runs on Vite, and the local printer backend runs at `http://127.0.0.1:5426`.
