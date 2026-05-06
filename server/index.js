import cors from 'cors';
import express from 'express';
import { Client as FTPClient } from 'basic-ftp';
import mqtt from 'mqtt';
import { Readable } from 'node:stream';

const PORT = Number(process.env.PLOTTER_SERVER_PORT || 5426);
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

  if (client) client.end(true);
  stopToolheadFanKeepalive();
  config = { host, serial, accessCode };
  connected = false;
  lastError = '';
  lastReport = null;

  client = mqtt.connect(`mqtts://${host}:8883`, {
    username: 'bblp',
    password: accessCode,
    clientId: `a1_plotter_${Date.now()}`,
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

  response.json({ ok: true, message: 'Connection started. Check status for live connection state.' });
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

app.listen(PORT, '127.0.0.1', () => {
  console.log(`A1 Plotter printer backend listening at http://127.0.0.1:${PORT}`);
});
