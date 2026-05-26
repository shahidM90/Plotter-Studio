import cors from 'cors';
import express from 'express';
import { Client as FTPClient } from 'basic-ftp';
import mqtt from 'mqtt';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import dgram from 'node:dgram';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PLOTTER_SERVER_PORT || 5426);
const HOST = process.env.PLOTTER_SERVER_HOST || '127.0.0.1';
const SHOULD_OPEN_BROWSER = process.env.PLOTTER_OPEN_BROWSER === '1';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATIC_DIR = process.env.PLOTTER_STATIC_DIR
  ? path.resolve(process.env.PLOTTER_STATIC_DIR)
  : path.resolve(__dirname, '../dist');
const PACKAGE_INFO = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
const GITHUB_PACKAGE_URL = 'https://raw.githubusercontent.com/shahidM90/Plotter-Studio/main/package.json';
const GITHUB_INSTALL_SPEC = 'git+https://github.com/shahidM90/Plotter-Studio.git';
const app = express();

app.use(cors({ origin: [/^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/localhost:\d+$/] }));
app.use(express.json({ limit: '2mb' }));

let client = null;
let config = null;
let connected = false;
let lastReport = null;
let lastError = '';
let sequence = Date.now();
let activeStream = null;
let lastSafeZ = 10;
let mqttLogSequence = 0;
let toolheadFanKeepalive = null;
const mqttLog = [];

function compareVersions(a, b) {
  const left = String(a).split('.').map((part) => Number(part) || 0);
  const right = String(b).split('.').map((part) => Number(part) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] || 0) > (right[index] || 0)) return 1;
    if ((left[index] || 0) < (right[index] || 0)) return -1;
  }
  return 0;
}

async function getLatestPackageInfo() {
  const response = await fetch(`${GITHUB_PACKAGE_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);
  return response.json();
}

function runNpmInstallUpdate() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand, ['install', '-g', GITHUB_INSTALL_SPEC, '--install-links'], {
      shell: process.platform === 'win32',
      windowsHide: true,
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(output.trim());
      else reject(new Error(output.trim() || `npm install exited with code ${code}`));
    });
  });
}

const blockedPatterns = [
  /^M109\b/i,
  /^M190\b/i,
  /^M141\b/i,
  /^M106\b/i,
  /^M82\b/i,
  /^M83\b/i,
  /^M302\b/i,
  /^M600\b/i,
  /^M701\b/i,
  /^M702\b/i,
  /^T\d+/i,
  /\bE-?\d/i,
];

const allowedCommands = /^(G0|G1|G4|G21|G28|G90|G91|G92|M2|M17|M18|M84|M104|M107|M140|M221|M400)\b/i;
const MAX_DIRECT_SEND_LINES = 6000;
const MAX_DIRECT_SEND_BYTES = 350000;
const DEFAULT_START_DELAY_MS = 2500;
const DEFAULT_LINE_DELAY_MS = 300;

function cleanLine(line) {
  return line.replace(/^N\d+\s+/i, '').split(';')[0].trim();
}

function isUnsafeSafetyCommand(line) {
  return (
    (/^M104\b/i.test(line) && !/^M104\s+S0(\s|$)/i.test(line))
    || (/^M140\b/i.test(line) && !/^M140\s+S0(\s|$)/i.test(line))
    || (/^M221\b/i.test(line) && !/^M221\s+S(0|100)(\s|$)/i.test(line))
  );
}

function homesZ(line) {
  return /^G28(\s*$|\s+(?=.*\bZ\b))/i.test(line);
}

function validateGCode(gcode, { allowNegativeZ = false, allowHome = true } = {}) {
  const lines = gcode.split(/\r?\n/);
  const errors = [];
  const executableLines = lines.filter((line) => cleanLine(line));

  if (gcode.length > MAX_DIRECT_SEND_BYTES) {
    errors.push(`G-code is too large for direct printer send (${gcode.length} bytes). Export and inspect it first.`);
  }

  if (executableLines.length > MAX_DIRECT_SEND_LINES) {
    errors.push(`G-code has too many motion lines for direct printer send (${executableLines.length}). Reduce detail or export to file.`);
  }

  lines.forEach((line, index) => {
    const cleaned = cleanLine(line);
    if (!cleaned) return;
    if (!allowedCommands.test(cleaned)) {
      errors.push(`Line ${index + 1}: unsupported command "${cleaned}"`);
    }
    if (blockedPatterns.some((pattern) => pattern.test(cleaned))) {
      errors.push(`Line ${index + 1}: blocked non-plotter command "${cleaned}"`);
    }
    if (isUnsafeSafetyCommand(cleaned)) {
      errors.push(`Line ${index + 1}: unsafe safety command "${cleaned}"`);
    }
    if (/^G28\b/i.test(cleaned) && !allowHome && homesZ(cleaned)) {
      errors.push(`Line ${index + 1}: Z homing is disabled for direct send because it resets calibrated Z`);
    }
    const zMatch = cleaned.match(/\bZ(-?\d+(\.\d+)?)/i);
    if (zMatch && Number(zMatch[1]) < 0 && !allowNegativeZ) {
      errors.push(`Line ${index + 1}: negative Z requires explicit confirmation`);
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    lineCount: executableLines.length,
    byteCount: gcode.length,
  };
}

function requireConnected(response) {
  if (!client || !connected || !config) {
    response.status(409).json({ ok: false, error: 'Printer is not connected.' });
    return false;
  }
  return true;
}

function requestTopic() {
  return `device/${config.serial}/request`;
}

function reportTopic() {
  return `device/${config.serial}/report`;
}

function nextSequence() {
  sequence += 1;
  return String(sequence);
}

function addMqttLog(direction, topic, payload) {
  mqttLogSequence += 1;
  mqttLog.push({
    id: mqttLogSequence,
    time: new Date().toISOString(),
    direction,
    topic,
    payload,
  });
  if (mqttLog.length > 250) mqttLog.splice(0, mqttLog.length - 250);
}

function parseSsdpPrinterMessage(raw, rinfo) {
  if (!/bambu|3dprinter/i.test(raw)) return null;
  const headers = {};
  raw.split(/\r?\n/).forEach((line) => {
    const index = line.indexOf(':');
    if (index > 0) headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
  });
  const usn = headers.usn || headers['dev-id.bambu.com'] || headers['dev_id.bambu.com'] || '';
  const serialMatch = usn.match(/[A-Z0-9]{8,}/i);
  return {
    host: rinfo.address,
    serial: headers['dev-id.bambu.com'] || headers['dev_id.bambu.com'] || serialMatch?.[0] || '',
    name: headers['dev-name.bambu.com'] || headers['dev_name.bambu.com'] || headers.server || 'Bambu printer',
    model: headers['dev-model.bambu.com'] || headers['dev_model.bambu.com'] || '',
    raw: Object.fromEntries(Object.entries(headers).filter(([key]) => key.includes('bambu') || ['usn', 'server', 'location'].includes(key))),
  };
}

async function discoverBambuPrinters(timeoutMs = 5000) {
  const found = new Map();
  const sockets = [];
  const addPrinter = (printer) => {
    if (!printer?.host) return;
    const key = printer.serial || printer.host;
    found.set(key, { ...found.get(key), ...printer });
  };

  await Promise.all([1900, 2021].map((port) => new Promise((resolve) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    sockets.push(socket);
    socket.on('message', (message, rinfo) => addPrinter(parseSsdpPrinterMessage(message.toString(), rinfo)));
    socket.on('error', () => resolve());
    socket.bind(port, '0.0.0.0', () => {
      try {
        socket.addMembership('239.255.255.250');
      } catch {
        // Another process may already own membership; direct replies still work.
      }
      resolve();
    });
  })));

  const searchSocket = dgram.createSocket('udp4');
  sockets.push(searchSocket);
  const search = [
    'M-SEARCH * HTTP/1.1',
    'HOST: 239.255.255.250:1900',
    'MAN: "ssdp:discover"',
    'MX: 2',
    'ST: urn:bambulab-com:device:3dprinter:1',
    '',
    '',
  ].join('\r\n');
  searchSocket.on('message', (message, rinfo) => addPrinter(parseSsdpPrinterMessage(message.toString(), rinfo)));
  searchSocket.bind(0, () => {
    searchSocket.setMulticastTTL(2);
    const payload = Buffer.from(search);
    [1900, 2021].forEach((port) => searchSocket.send(payload, port, '239.255.255.250'));
  });

  await sleep(timeoutMs);
  sockets.forEach((socket) => {
    try { socket.close(); } catch { /* closed already */ }
  });
  return [...found.values()].sort((a, b) => `${a.name}${a.host}`.localeCompare(`${b.name}${b.host}`));
}

function publish(payload, qos = 0) {
  return new Promise((resolve, reject) => {
    const topic = requestTopic();
    addMqttLog('out', topic, payload);
    client.publish(topic, JSON.stringify(payload), { qos }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function startPrinterConnection({ host, serial, accessCode }) {
  if (client) client.end(true);
  stopToolheadFanKeepalive();
  config = { host, serial, accessCode };
  connected = false;
  lastError = '';
  lastReport = null;

  client = mqtt.connect(`mqtts://${host}:8883`, {
    username: 'bblp',
    password: accessCode,
    clientId: `plotter_studio_${Date.now()}`,
    rejectUnauthorized: false,
    connectTimeout: 8000,
    reconnectPeriod: 3000,
  });

  client.on('connect', () => {
    connected = true;
    client.subscribe(reportTopic());
  });

  client.on('message', (topic, message) => {
    if (topic !== reportTopic()) return;
    try {
      lastReport = JSON.parse(message.toString());
      addMqttLog('in', topic, lastReport);
    } catch {
      lastReport = { raw: message.toString() };
      addMqttLog('in', topic, lastReport);
    }
  });

  client.on('error', (error) => {
    lastError = error.message;
  });

  client.on('close', () => {
    connected = false;
  });
}

async function sendGCode(gcode) {
  const param = gcode.endsWith('\n') ? gcode : `${gcode}\n`;
  await publish({
    print: {
      sequence_id: nextSequence(),
      command: 'gcode_line',
      param,
    },
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function stopToolheadFanKeepalive() {
  if (toolheadFanKeepalive) clearInterval(toolheadFanKeepalive);
  toolheadFanKeepalive = null;
}

function executableGCodeLines(gcode) {
  return gcode
    .split(/\r?\n/)
    .map((line) => cleanLine(line))
    .filter(Boolean);
}

async function sendGCodeStream(gcode, lineDelayMs = DEFAULT_LINE_DELAY_MS) {
  const lines = executableGCodeLines(gcode);
  let sent = 0;
  const delay = Math.max(80, Math.min(Number(lineDelayMs) || DEFAULT_LINE_DELAY_MS, 2000));
  activeStream = { abort: false, paused: false };
  for (const line of lines) {
    if (activeStream.abort) break;
    while (activeStream.paused && !activeStream.abort) {
      await sleep(150);
    }
    if (activeStream.abort) break;
    await sendGCode(line);
    sent += 1;
    await sleep(delay);
  }
  activeStream = null;
  return sent;
}

async function uploadGCodeFile(gcode, filename) {
  const ftp = new FTPClient(15000);
  try {
    await ftp.access({
      host: config.host,
      port: 990,
      user: 'bblp',
      password: config.accessCode,
      secure: 'implicit',
      secureOptions: { rejectUnauthorized: false },
    });
    await ftp.uploadFrom(Readable.from([gcode]), `/cache/${filename}`);
  } finally {
    ftp.close();
  }
}

async function startGCodeFile(filename) {
  await publish({
    print: {
      sequence_id: nextSequence(),
      command: 'gcode_file',
      param: `cache/${filename}`,
    },
  });
}

async function sendPrintControl(command) {
  await publish({
    print: {
      sequence_id: nextSequence(),
      command,
      param: '',
      reason: 'success',
      result: 'success',
    },
  }, 1);
}

async function emergencyStopPlot() {
  if (activeStream) activeStream.abort = true;

  await sendPrintControl('pause');
  await sleep(80);
  await sendPrintControl('stop');
  await sleep(80);

  // Some Bambu raw G-code paths ignore job stop. These direct lines are a best-effort
  // plotter safety fallback to stop motion after the printer accepts new commands.
  await sendGCode(`M400\nG0 Z${lastSafeZ.toFixed(2)} F3000\nM400`);
}

app.get('/api/app/version', (request, response) => {
  response.json({ ok: true, version: PACKAGE_INFO.version, name: PACKAGE_INFO.name });
});

app.get('/api/app/check-update', async (request, response) => {
  try {
    const latest = await getLatestPackageInfo();
    response.json({
      ok: true,
      currentVersion: PACKAGE_INFO.version,
      latestVersion: latest.version,
      updateAvailable: compareVersions(latest.version, PACKAGE_INFO.version) > 0,
    });
  } catch (error) {
    response.status(502).json({ ok: false, error: `Could not check GitHub for updates: ${error.message}` });
  }
});

app.post('/api/app/update', async (request, response) => {
  try {
    const latest = await getLatestPackageInfo();
    const updateAvailable = compareVersions(latest.version, PACKAGE_INFO.version) > 0;
    if (!updateAvailable && !request.body?.force) {
      response.json({
        ok: true,
        message: `Plotter Studio is already up to date at v${PACKAGE_INFO.version}.`,
        currentVersion: PACKAGE_INFO.version,
        latestVersion: latest.version,
      });
      return;
    }

    await runNpmInstallUpdate();
    response.json({
      ok: true,
      message: `Updated to v${latest.version}. Restarting Plotter Studio...`,
      currentVersion: PACKAGE_INFO.version,
      latestVersion: latest.version,
      restarting: true,
    });
    restartAfterUpdate();
  } catch (error) {
    response.status(500).json({ ok: false, error: `Update failed: ${error.message}` });
  }
});

app.get('/api/printer/status', (request, response) => {
  response.json({
    ok: true,
    connected,
    config: config ? { host: config.host, serial: config.serial } : null,
    lastReport,
    lastError,
  });
});

app.get('/api/printer/mqtt-log', (request, response) => {
  const since = Number(request.query.since || 0);
  response.json({
    ok: true,
    entries: mqttLog.filter((entry) => entry.id > since),
    lastId: mqttLogSequence,
  });
});

app.post('/api/printer/mqtt-log/clear', (request, response) => {
  mqttLog.length = 0;
  response.json({ ok: true, lastId: mqttLogSequence });
});

app.post('/api/printer/connect', (request, response) => {
  const { host, serial, accessCode } = request.body;
  if (!host || !serial || !accessCode) {
    response.status(400).json({ ok: false, error: 'Host, serial, and access code are required.' });
    return;
  }

  startPrinterConnection({ host, serial, accessCode });
  response.json({ ok: true, message: 'Connection started. Check status for live connection state.' });
});

app.post('/api/printer/discover', async (request, response) => {
  const { serial = '', accessCode = '', autoConnect = true } = request.body || {};
  const printers = await discoverBambuPrinters();
  const normalizedSerial = String(serial).trim().toLowerCase();
  const serialMatch = normalizedSerial
    ? printers.find((printer) => String(printer.serial || '').toLowerCase() === normalizedSerial)
    : null;
  const matched = serialMatch || (printers.length === 1 ? printers[0] : null);

  if (autoConnect && matched && accessCode) {
    const connectionSerial = matched.serial || serial;
    if (!connectionSerial) {
      response.json({
        ok: true,
        printers,
        selectedPrinter: { host: matched.host, serial: matched.serial || '', name: matched.name, model: matched.model },
        message: `Found ${matched.name || 'Bambu printer'} at ${matched.host}, but no serial was discovered. Enter the serial once, then connect.`,
      });
      return;
    }
    startPrinterConnection({ host: matched.host, serial: connectionSerial, accessCode });
    response.json({
      ok: true,
      printers,
      connectedPrinter: { host: matched.host, serial: connectionSerial, name: matched.name, model: matched.model },
      message: `Found ${matched.name || 'Bambu printer'} at ${matched.host}. Connection started with saved access code.`,
    });
    return;
  }

  response.json({
    ok: true,
    printers,
    selectedPrinter: matched ? { host: matched.host, serial: matched.serial || '', name: matched.name, model: matched.model } : null,
    message: printers.length
      ? `Found ${printers.length} Bambu printer${printers.length === 1 ? '' : 's'}.`
      : 'No Bambu printers found on this network.',
  });
});

app.post('/api/printer/disconnect', (request, response) => {
  stopToolheadFanKeepalive();
  if (client) client.end(true);
  client = null;
  config = null;
  connected = false;
  lastReport = null;
  response.json({ ok: true });
});

app.post('/api/printer/send-gcode', async (request, response) => {
  if (!requireConnected(response)) return;
  const { gcode, confirmed = false, allowNegativeZ = false, allowHome = false, method = 'file', startDelayMs = DEFAULT_START_DELAY_MS, lineDelayMs = DEFAULT_LINE_DELAY_MS } = request.body;
  if (!confirmed) {
    response.status(400).json({ ok: false, error: 'Safety confirmation is required before sending G-code.' });
    return;
  }
  const validation = validateGCode(gcode || '', { allowNegativeZ, allowHome });
  if (!validation.ok) {
    response.status(400).json({ ok: false, validation });
    return;
  }
  const safeZMatch = (gcode || '').match(/\bG0\s+Z(\d+(\.\d+)?)\s+F/i);
  if (safeZMatch) lastSafeZ = Number(safeZMatch[1]);

  const resolvedMethod = method;

  if (resolvedMethod === 'stream') {
    const sentLineCount = await sendGCodeStream(gcode, lineDelayMs);
    response.json({ ok: true, validation, method: resolvedMethod, sentLineCount, lineDelayMs });
    return;
  }

  const filename = `a1_plotter_${Date.now()}.gcode`;
  await uploadGCodeFile(gcode, filename);
  await sleep(Math.max(0, Math.min(Number(startDelayMs) || DEFAULT_START_DELAY_MS, 10000)));
  await startGCodeFile(filename);
  response.json({ ok: true, validation, method: resolvedMethod, filename: `cache/${filename}`, startDelayMs });
});

app.post('/api/printer/preflight-gcode', (request, response) => {
  const { gcode, allowNegativeZ = false, allowHome = false } = request.body;
  const validation = validateGCode(gcode || '', { allowNegativeZ, allowHome });
  response.json({ ok: true, validation });
});

app.post('/api/printer/jog', async (request, response) => {
  if (!requireConnected(response)) return;
  const { x = 0, y = 0, z = 0, feedrate = 1200, confirmed = false } = request.body;
  const move = { x: Number(x), y: Number(y), z: Number(z), feedrate: Number(feedrate) };
  if ([move.x, move.y, move.z, move.feedrate].some((value) => !Number.isFinite(value))) {
    response.status(400).json({ ok: false, error: 'Jog values must be finite numbers.' });
    return;
  }
  if (Math.max(Math.abs(move.x), Math.abs(move.y), Math.abs(move.z)) > 50) {
    response.status(400).json({ ok: false, error: 'Jog moves are limited to 50 mm per command.' });
    return;
  }
  if (move.z < 0 && !confirmed) {
    response.status(400).json({ ok: false, error: 'Negative Z jog requires confirmation.' });
    return;
  }

  const parts = ['G91'];
  const axes = [];
  if (move.x) axes.push(`X${move.x.toFixed(2)}`);
  if (move.y) axes.push(`Y${move.y.toFixed(2)}`);
  if (move.z) axes.push(`Z${move.z.toFixed(2)}`);
  if (axes.length) parts.push(`G0 ${axes.join(' ')} F${Math.round(move.feedrate)}`);
  parts.push('G90');
  await sendGCode(parts.join('\n'));
  response.json({ ok: true });
});

app.post('/api/printer/move-absolute', async (request, response) => {
  if (!requireConnected(response)) return;
  const { x = 0, y = 0, z = 10, feedrate = 3000, confirmed = false } = request.body;
  const target = {
    x: Number(x), y: Number(y), z: Number(z), feedrate: Number(feedrate),
  };
  if ([target.x, target.y, target.z, target.feedrate].some((value) => !Number.isFinite(value))) {
    response.status(400).json({ ok: false, error: 'Move values must be finite numbers.' });
    return;
  }
  if (target.z < 0 && !confirmed) {
    response.status(400).json({ ok: false, error: 'Negative Z requires confirmation.' });
    return;
  }

  const gcode = [
    'G90',
    `G0 Z${target.z.toFixed(2)} F${Math.round(target.feedrate)}`,
    'M400',
    `G0 X${target.x.toFixed(2)} Y${target.y.toFixed(2)} F${Math.round(target.feedrate)}`,
  ].join('\n');

  await sendGCode(gcode);
  response.json({ ok: true });
});

app.post('/api/printer/set-z-zero', async (request, response) => {
  if (!requireConnected(response)) return;
  const { confirmed = false } = request.body;
  if (!confirmed) {
    response.status(400).json({ ok: false, error: 'Confirm that the pen tip is touching the paper before setting Z zero.' });
    return;
  }
  await sendGCode('G92 Z0');
  response.json({ ok: true });
});

app.post('/api/printer/toolhead-fan', async (request, response) => {
  if (!requireConnected(response)) return;
  const { on = true } = request.body;
  const speed = on ? 255 : 0;
  stopToolheadFanKeepalive();
  await sendGCode(`M106 P0 S${speed}`);
  if (on) {
    toolheadFanKeepalive = setInterval(() => {
      if (!client || !connected) {
        stopToolheadFanKeepalive();
        return;
      }
      sendGCode('M106 P0 S255').catch((error) => {
        lastError = error.message;
        stopToolheadFanKeepalive();
      });
    }, 1000);
  }
  response.json({
    ok: true,
    message: on
      ? 'Toolhead/hotend fan keepalive started: M106 P0 S255 every 1s.'
      : 'Toolhead/hotend fan keepalive stopped: M106 P0 S0 sent.',
  });
});

app.post('/api/printer/home', async (request, response) => {
  if (!requireConnected(response)) return;
  await sendGCode('G28');
  response.json({ ok: true });
});

app.post('/api/printer/release-motors', async (request, response) => {
  if (!requireConnected(response)) return;
  const gcode = [
    '; Plotter Studio motor release',
    'G90',
    'M400',
    'M18 X Y Z',
    'M84 X Y Z',
    'M84',
    'M400',
    '',
  ].join('\n');
  const filename = `plotter_release_motors_${Date.now()}.gcode`;
  await uploadGCodeFile(gcode, filename);
  await sleep(500);
  await startGCodeFile(filename);
  response.json({ ok: true, message: `Motor release file started: cache/${filename}.` });
});

app.post('/api/printer/pause', async (request, response) => {
  if (!requireConnected(response)) return;
  if (activeStream) activeStream.paused = true;
  await sendPrintControl('pause');
  response.json({ ok: true, message: activeStream ? 'Paused line streaming and sent printer pause.' : 'Pause command sent.' });
});

app.post('/api/printer/resume', async (request, response) => {
  if (!requireConnected(response)) return;
  if (activeStream) activeStream.paused = false;
  await sendPrintControl('resume');
  response.json({ ok: true, message: activeStream ? 'Resumed line streaming and sent printer resume.' : 'Resume command sent.' });
});

app.post('/api/printer/stop', async (request, response) => {
  if (!requireConnected(response)) return;
  await emergencyStopPlot();
  response.json({ ok: true, message: 'Emergency stop sent: pause, stop, and safe Z lift requested.' });
});

if (existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR));
  app.get(/.*/, (request, response) => {
    response.sendFile(path.join(STATIC_DIR, 'index.html'));
  });
}

function openBrowser(url) {
  const command = process.platform === 'win32'
    ? 'cmd'
    : process.platform === 'darwin'
      ? 'open'
      : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.unref();
}

function restartAfterUpdate() {
  const command = process.platform === 'win32' ? 'cmd' : 'sh';
  const args = process.platform === 'win32'
    ? ['/c', 'timeout /t 2 /nobreak >nul & plotterstudio server']
    : ['-c', 'sleep 2; plotterstudio server'];
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  setTimeout(() => process.exit(0), 500);
}

function startServer(port = PORT, host = HOST, { openBrowser: shouldOpen } = {}) {
  return new Promise((resolve) => {
    const server = app.listen(port, host, () => {
      const url = `http://${host}:${port}`;
      console.log(`Plotter Studio server listening at ${url}`);
      if (existsSync(STATIC_DIR)) console.log(`Serving app from ${STATIC_DIR}`);
      if (shouldOpen || SHOULD_OPEN_BROWSER) openBrowser(url);
      resolve(server);
    });
  });
}

export { app, startServer };

const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith(path.sep + 'index.js') ||
  process.argv[1].endsWith(path.sep + 'plotterstudio.js') ||
  process.argv[1].endsWith('plotterstudio')
);

if (isDirectRun) {
  startServer(PORT, HOST, { openBrowser: SHOULD_OPEN_BROWSER });
}
