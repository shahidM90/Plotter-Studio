#!/usr/bin/env node

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const command = process.argv[2] || 'server';
const args = new Set(process.argv.slice(3));

function printHelp() {
  console.log(`
Plotter Studio

Usage:
  plotterstudio server [--port 5426] [--no-open]
  plotter-studio server [--port 5426] [--no-open]

Commands:
  server    Start the local printer backend and web app.
`);
}

if (command === '--help' || command === '-h' || command === 'help') {
  printHelp();
  process.exit(0);
}

if (command !== 'server') {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

const portIndex = process.argv.indexOf('--port');
if (portIndex !== -1 && process.argv[portIndex + 1]) {
  process.env.PLOTTER_SERVER_PORT = process.argv[portIndex + 1];
}

process.env.PLOTTER_OPEN_BROWSER = args.has('--no-open') ? '0' : '1';
process.env.PLOTTER_STATIC_DIR = path.join(rootDir, 'dist');

if (!existsSync(process.env.PLOTTER_STATIC_DIR)) {
  console.warn('Built web app was not found. Run `npm run build` before starting the release server.');
}

await import('../server/index.js');
