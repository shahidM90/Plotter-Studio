import QRCode from 'qrcode';
import hersheyFonts from 'hersheytext/hersheytext.min.json';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import packageInfo from '../package.json';
import './App.css';

const PRESETS = {
  a1: { label: 'Bambu Lab A1', bedWidth: 256, bedHeight: 256, paperWidth: 210, paperHeight: 210, feedrate: 1200, travelSpeed: 3000 },
  a1mini: { label: 'Bambu Lab A1 mini', bedWidth: 180, bedHeight: 180, paperWidth: 148, paperHeight: 148, feedrate: 1100, travelSpeed: 2800 },
  x1c: { label: 'Bambu Lab X1 Carbon', bedWidth: 256, bedHeight: 256, paperWidth: 220, paperHeight: 220, feedrate: 1300, travelSpeed: 3200 },
  p1s: { label: 'Bambu Lab P1S', bedWidth: 256, bedHeight: 256, paperWidth: 220, paperHeight: 220, feedrate: 1300, travelSpeed: 3200 },
  custom: { label: 'Custom Board', bedWidth: 256, bedHeight: 256, paperWidth: 210, paperHeight: 210, feedrate: 1200, travelSpeed: 3000 },
};

const HERSHEY = {
  A: ['0,1 0.5,0 1,1', '0.22,0.58 0.78,0.58'],
  B: ['0,0 0,1 0.68,1 0.9,0.82 0.68,0.58 0,0.58', '0,0.58 0.72,0.58 0.94,0.34 0.72,0 0,0'],
  C: ['0.92,0.15 0.72,0 0.25,0 0,0.28 0,0.72 0.25,1 0.72,1 0.92,0.85'],
  D: ['0,0 0,1', '0,0 0.62,0 0.95,0.32 0.95,0.68 0.62,1 0,1'],
  E: ['0.9,0 0,0 0,1 0.9,1', '0,0.5 0.65,0.5'],
  F: ['0,1 0,0 0.9,0', '0,0.5 0.65,0.5'],
  G: ['0.92,0.18 0.72,0 0.25,0 0,0.28 0,0.72 0.25,1 0.75,1 0.98,0.72 0.98,0.58 0.62,0.58'],
  H: ['0,0 0,1', '1,0 1,1', '0,0.5 1,0.5'],
  I: ['0.2,0 0.8,0', '0.5,0 0.5,1', '0.2,1 0.8,1'],
  J: ['0.9,0 0.9,0.76 0.72,1 0.35,1 0.1,0.82'],
  K: ['0,0 0,1', '1,0 0,0.56 1,1'],
  L: ['0,0 0,1 0.88,1'],
  M: ['0,1 0,0 0.5,0.58 1,0 1,1'],
  N: ['0,1 0,0 1,1 1,0'],
  O: ['0.5,0 0.86,0.14 1,0.5 0.86,0.86 0.5,1 0.14,0.86 0,0.5 0.14,0.14 0.5,0'],
  P: ['0,1 0,0 0.72,0 0.95,0.22 0.72,0.5 0,0.5'],
  Q: ['0.5,0 0.86,0.14 1,0.5 0.86,0.86 0.5,1 0.14,0.86 0,0.5 0.14,0.14 0.5,0', '0.62,0.68 1,1'],
  R: ['0,1 0,0 0.72,0 0.95,0.22 0.72,0.5 0,0.5', '0.45,0.5 1,1'],
  S: ['0.9,0.14 0.68,0 0.25,0 0.05,0.22 0.25,0.48 0.72,0.52 0.95,0.76 0.72,1 0.25,1 0.05,0.84'],
  T: ['0,0 1,0', '0.5,0 0.5,1'],
  U: ['0,0 0,0.74 0.22,1 0.78,1 1,0.74 1,0'],
  V: ['0,0 0.5,1 1,0'],
  W: ['0,0 0.22,1 0.5,0.45 0.78,1 1,0'],
  X: ['0,0 1,1', '1,0 0,1'],
  Y: ['0,0 0.5,0.5 1,0', '0.5,0.5 0.5,1'],
  Z: ['0,0 1,0 0,1 1,1'],
  '0': ['0.5,0 0.86,0.14 1,0.5 0.86,0.86 0.5,1 0.14,0.86 0,0.5 0.14,0.14 0.5,0'],
  '1': ['0.35,0.24 0.5,0 0.5,1', '0.3,1 0.72,1'],
  '2': ['0.12,0.22 0.32,0 0.75,0 0.95,0.22 0.1,1 0.95,1'],
  '3': ['0.12,0.15 0.34,0 0.78,0 0.96,0.25 0.68,0.5 0.96,0.75 0.78,1 0.34,1 0.12,0.85'],
  '4': ['0.78,1 0.78,0', '0.12,0.65 0.95,0.65 0.72,0'],
  '5': ['0.9,0 0.18,0 0.08,0.46 0.72,0.46 0.95,0.7 0.75,1 0.25,1 0.08,0.85'],
  '6': ['0.86,0.12 0.62,0 0.2,0.15 0,0.5 0.18,0.9 0.58,1 0.92,0.78 0.78,0.52 0.2,0.5'],
  '7': ['0.08,0 0.95,0 0.35,1'],
  '8': ['0.5,0 0.86,0.16 0.78,0.42 0.5,0.5 0.22,0.42 0.14,0.16 0.5,0', '0.5,0.5 0.9,0.66 0.8,0.94 0.5,1 0.2,0.94 0.1,0.66 0.5,0.5'],
  '9': ['0.82,0.5 0.22,0.48 0.08,0.22 0.42,0 0.82,0.1 1,0.5 0.8,0.88 0.38,1 0.12,0.84'],
  '-': ['0.18,0.5 0.82,0.5'],
  '.': ['0.5,0.92 0.52,0.94'],
  '/': ['0.95,0 0.05,1'],
  '?': ['0.18,0.22 0.34,0 0.7,0 0.9,0.2 0.82,0.42 0.52,0.58 0.52,0.72', '0.52,0.92 0.54,0.94'],
  '!': ['0.5,0 0.5,0.72', '0.5,0.92 0.52,0.94'],
  ':': ['0.5,0.34 0.52,0.36', '0.5,0.76 0.52,0.78'],
  ',': ['0.56,0.9 0.42,1.1'],
  '+': ['0.5,0.2 0.5,0.8', '0.2,0.5 0.8,0.5'],
  '=': ['0.2,0.38 0.8,0.38', '0.2,0.62 0.8,0.62'],
  "'": ['0.48,0 0.38,0.22'],
  '"': ['0.34,0 0.28,0.22', '0.66,0 0.6,0.22'],
  '&': ['0.78,1 0.22,0.38 0.24,0.08 0.52,0 0.76,0.18 0.18,0.78 0.32,1 0.72,0.74'],
};

const DEFAULT_HERSHEY_FONT = 'simplex';
const LEGACY_FONT_OPTIONS = {
  simplex: { label: 'Hershey Simplex', slant: 0, weight: 1, width: 1, gap: 0 },
  duplex: { label: 'Hershey Duplex', slant: 0, weight: 2, width: 1, gap: 0 },
  italic: { label: 'Hershey Italic', slant: -0.18, weight: 1, width: 1, gap: 0 },
  condensed: { label: 'Hershey Condensed', slant: 0, weight: 1, width: 0.72, gap: 0.1 },
  wide: { label: 'Hershey Wide', slant: 0, weight: 1, width: 1.22, gap: 0 },
  shadow: { label: 'Plotter Shadow', slant: 0, weight: 2, width: 1, gap: 0.08 },
};
const REAL_HERSHEY_FONT_KEYS = ['futural', 'futuram', 'timesr', 'timesi', 'timesrb', 'scripts', 'scriptc', 'cursive', 'gothiceng', 'markers'];
const FONT_OPTIONS = {
  ...LEGACY_FONT_OPTIONS,
  ...Object.fromEntries(REAL_HERSHEY_FONT_KEYS
    .filter((key) => hersheyFonts[key])
    .map((key) => [key, { label: `Real ${hersheyFonts[key].name}` }])),
};
const isLegacyFont = (fontKey) => Boolean(LEGACY_FONT_OPTIONS[fontKey]);

const normalizeTextForGlyphs = (text) => text
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-');

const getHersheyChar = (char, fontKey = DEFAULT_HERSHEY_FONT) => {
  if (isLegacyFont(fontKey)) {
    const legacyGlyph = HERSHEY[char.toUpperCase()];
    return legacyGlyph ? { legacyGlyph, width: 10 } : null;
  }
  const font = hersheyFonts[fontKey] || hersheyFonts.futural;
  if (!font || char === ' ' || char === '\n') return null;
  const data = font.chars?.[char.charCodeAt(0) - 33];
  if (data?.d) return { ...data, width: Number(data.o) || 10 };
  return null;
};

const unsupportedTextChars = (items) => {
  const unsupported = new Set();
  items.forEach((item) => {
    [...normalizeTextForGlyphs(item.text)].forEach((char) => {
      if (char !== ' ' && char !== '\n' && !getHersheyChar(char, item.fontKey)) unsupported.add(char);
    });
  });
  return [...unsupported];
};

const compressedTextItems = (items) => items.filter((item) => {
  const visibleChars = [...normalizeTextForGlyphs(item.text)].filter((char) => char !== ' ').length || 1;
  return item.object.w / visibleChars < MIN_TEXT_CHAR_WIDTH_MM;
});

const defaultSettings = {
  preset: 'a1',
  bedWidth: 256,
  bedHeight: 256,
  paperWidth: 210,
  paperHeight: 210,
  scale: 1,
  penUpZ: 5,
  penDownZ: 0,
  safeZ: 10,
  feedrate: 1200,
  travelSpeed: 3000,
  originX: 20,
  originY: 20,
  parkX: 0,
  parkY: 256,
  penTipOffsetX: 0,
  penTipOffsetY: -30,
  penOffsetX: 0,
  penOffsetY: 0,
  mirrorOutputX: true,
  mirrorOutputY: false,
  homeBeforePlot: true,
};

const defaultObject = { x: 58, y: 88, w: 140, h: 54, angle: 0 };
const colors = ['#101827', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#2563eb'];
const PRINTER_API = import.meta.env.VITE_PRINTER_API_URL || 'http://127.0.0.1:5426';
const PRINTER_STORAGE_KEY = 'a1-plotter-printer-config';
const DRAW_MIN_DISTANCE_MM = 1.2;
const DRAW_MAX_POINTS_PER_STROKE = 900;
const MIN_TEXT_CHAR_WIDTH_MM = 5;
const BLOCKED_GCODE_PATTERNS = [
  /^M109\b/i,
  /^M190\b/i,
  /^M106\b/i,
  /\bE-?\d/i,
];
const ALLOWED_GCODE_COMMANDS = /^(G0|G1|G4|G21|G28|G90|G91|G92|M2|M17|M18|M84|M104|M107|M140|M221|M400)\b/i;

const loadPrinterConfig = () => {
  try {
    const saved = localStorage.getItem(PRINTER_STORAGE_KEY);
    if (!saved) return { host: '', serial: '', accessCode: '' };
    return { host: '', serial: '', accessCode: '', ...JSON.parse(saved) };
  } catch {
    return { host: '', serial: '', accessCode: '' };
  }
};

const getMqttEntrySummary = (entry) => {
  const payload = entry.payload || {};
  const print = payload.print;
  if (print?.command === 'gcode_line') {
    const line = String(print.param || '').trim().split(/\r?\n/)[0] || '(blank line)';
    return {
      title: 'G-code line',
      detail: line.length > 90 ? `${line.slice(0, 90)}...` : line,
      sequence: print.sequence_id,
    };
  }
  if (print?.command) {
    return {
      title: print.command,
      detail: print.param || print.reason || print.result || 'Printer command',
      sequence: print.sequence_id,
    };
  }
  if (payload.print?.gcode_state) {
    return { title: 'Printer state', detail: payload.print.gcode_state, sequence: payload.print.sequence_id };
  }
  if (payload.print) return { title: 'Printer report', detail: Object.keys(payload.print).slice(0, 5).join(', '), sequence: payload.print.sequence_id };
  return { title: entry.direction === 'out' ? 'Outgoing payload' : 'Printer report', detail: Object.keys(payload).slice(0, 5).join(', ') || 'JSON payload' };
};

const prettyMqttPayload = (payload) => JSON.stringify(payload, null, 2);

const stripLineNumber = (line) => line.replace(/^N\d+\s+/i, '');
const cleanGCodeLine = (line) => stripLineNumber(line).split(';')[0].trim();

const isUnsafeSafetyCommand = (line) => (
  (/^M104\b/i.test(line) && !/^M104\s+S0(\s|$)/i.test(line))
  || (/^M140\b/i.test(line) && !/^M140\s+S0(\s|$)/i.test(line))
  || (/^M221\b/i.test(line) && !/^M221\s+S(0|100)(\s|$)/i.test(line))
);

const homesZ = (line) => /^G28(\s*$|\s+(?=.*\bZ\b))/i.test(line);

const validateGCodeLocally = (gcode, { allowNegativeZ = false, allowHome = false } = {}) => {
  const errors = [];
  const executableLines = gcode.split(/\r?\n/).filter((line) => cleanGCodeLine(line));

  executableLines.forEach((line, index) => {
    const cleaned = cleanGCodeLine(line);
    if (!ALLOWED_GCODE_COMMANDS.test(cleaned)) errors.push(`Line ${index + 1}: unsupported command "${cleaned}"`);
    if (BLOCKED_GCODE_PATTERNS.some((pattern) => pattern.test(cleaned))) errors.push(`Line ${index + 1}: blocked command "${cleaned}"`);
    if (isUnsafeSafetyCommand(cleaned)) errors.push(`Line ${index + 1}: unsafe safety command "${cleaned}"`);
    if (/^G28\b/i.test(cleaned) && !allowHome && homesZ(cleaned)) errors.push(`Line ${index + 1}: Z homing is disabled for direct send`);
    const zMatch = cleaned.match(/\bZ(-?\d+(\.\d+)?)/i);
    if (zMatch && Number(zMatch[1]) < 0 && !allowNegativeZ) errors.push(`Line ${index + 1}: negative Z requires confirmation`);
  });

  return {
    ok: errors.length === 0,
    errors,
    lineCount: executableLines.length,
    byteCount: gcode.length,
  };
};

const createTextItem = (id, index = 0) => ({
  id,
  text: index === 0 ? 'Plotter Studio' : `TEXT ${index + 1}`,
  fontKey: DEFAULT_HERSHEY_FONT,
  object: {
    ...defaultObject,
    x: defaultObject.x + index * 10,
    y: defaultObject.y + index * 14,
  },
});

const rotatePoint = (x, y, cx, cy, angleDeg) => {
  const angle = (angleDeg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: cy + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
};

const transformLocalPoint = (point, object) => {
  const cx = object.x + object.w / 2;
  const cy = object.y + object.h / 2;
  return rotatePoint(object.x + point.x, object.y + point.y, cx, cy, object.angle);
};

const parseStroke = (stroke, x, y, w, h) => stroke.split(' ').map((pair) => {
  const [px, py] = pair.split(',').map(Number);
  return { x: x + px * w, y: y + py * h };
});

const makeLegacyTextPaths = (text, object, fontKey = DEFAULT_HERSHEY_FONT) => {
  const font = LEGACY_FONT_OPTIONS[fontKey] || LEGACY_FONT_OPTIONS.simplex;
  const chars = [...normalizeTextForGlyphs(text).toUpperCase()];
  if (!chars.length) return [];
  const charW = object.w / Math.max(chars.length, 1);
  return chars.flatMap((char, index) => {
    if (char === ' ') return [];
    const glyph = HERSHEY[char];
    if (!glyph) return [];
    const glyphWidth = charW * 0.72 * font.width;
    const left = index * charW + charW * (0.14 + font.gap);
    const strokes = glyph.map((stroke) => {
      const local = parseStroke(stroke, left, object.h * 0.1, glyphWidth, object.h * 0.8).map((point) => ({
        x: point.x + (point.y - object.h * 0.5) * font.slant,
        y: point.y,
      }));
      return local.map((point) => transformLocalPoint(point, object));
    });

    if (font.weight === 1) return strokes.map((stroke) => stroke.map((point) => ({ ...point, source: 'text' })));

    const offset = Math.max(0.55, charW * 0.018);
    return [
      ...strokes,
      ...strokes.map((stroke) => stroke.map((point) => ({ x: point.x + offset, y: point.y + offset }))),
    ].map((stroke) => stroke.map((point) => ({ ...point, source: 'text' })));
  });
};

const parseHersheyPathData = (d, offsetX, offsetY) => {
  const tokens = d.match(/[MmLlZz]|-?\d*\.?\d+/g) || [];
  const paths = [];
  let path = [];
  let command = null;
  let index = 0;

  const readPoint = () => {
    if (index + 1 >= tokens.length || Number.isNaN(Number(tokens[index])) || Number.isNaN(Number(tokens[index + 1]))) return null;
    const point = { x: Number(tokens[index]) + offsetX, y: Number(tokens[index + 1]) + offsetY };
    index += 2;
    return point;
  };

  while (index < tokens.length) {
    const token = tokens[index];
    if (/^[MmLlZz]$/.test(token)) {
      command = token.toUpperCase();
      index += 1;
      if (command === 'Z') {
        if (path.length) paths.push(path);
        path = [];
      }
      continue;
    }

    const point = readPoint();
    if (!point) {
      index += 1;
      continue;
    }

    if (command === 'M') {
      if (path.length) paths.push(path);
      path = [point];
      command = 'L';
    } else {
      path.push(point);
    }
  }

  if (path.length) paths.push(path);
  return paths.filter((item) => item.length > 1);
};

const glyphToRawPaths = (charData, offsetX, offsetY) => {
  if (charData.legacyGlyph) {
    return charData.legacyGlyph.map((stroke) => parseStroke(stroke, offsetX, offsetY, 10, 22));
  }
  return parseHersheyPathData(charData.d, offsetX, offsetY);
};

const makeTextPaths = (text, object, fontKey = DEFAULT_HERSHEY_FONT) => {
  if (isLegacyFont(fontKey)) return makeLegacyTextPaths(text, object, fontKey);

  const chars = [...normalizeTextForGlyphs(text)];
  if (!chars.length) return [];

  const rawPaths = [];
  let cursorX = 0;
  let cursorY = 0;
  const advanceScale = 1.68;
  const lineHeight = 28;
  const spaceWidth = 10 * advanceScale;

  chars.forEach((char) => {
    if (char === '\n') {
      cursorX = 0;
      cursorY += lineHeight;
      return;
    }
    if (char === ' ') {
      cursorX += spaceWidth;
      return;
    }

    const charData = getHersheyChar(char, fontKey);
    if (!charData) return;
    rawPaths.push(...glyphToRawPaths(charData, cursorX, cursorY));
    cursorX += charData.width * advanceScale;
  });

  const boundsPoints = rawPaths.flat();
  if (!boundsPoints.length) return [];
  const minX = Math.min(...boundsPoints.map((point) => point.x));
  const maxX = Math.max(...boundsPoints.map((point) => point.x));
  const minY = Math.min(...boundsPoints.map((point) => point.y));
  const maxY = Math.max(...boundsPoints.map((point) => point.y));
  const rawWidth = Math.max(maxX - minX, 1);
  const rawHeight = Math.max(maxY - minY, 1);
  const padding = Math.min(object.w, object.h) * 0.06;
  const targetWidth = Math.max(object.w - padding * 2, 1);
  const targetHeight = Math.max(object.h - padding * 2, 1);
  const scale = Math.min(targetWidth / rawWidth, targetHeight / rawHeight);
  const fittedWidth = rawWidth * scale;
  const fittedHeight = rawHeight * scale;
  const left = padding + (targetWidth - fittedWidth) / 2;
  const top = padding + (targetHeight - fittedHeight) / 2;

  return rawPaths.map((path) => path.map((point) => transformLocalPoint({
    x: left + (point.x - minX) * scale,
    y: top + (point.y - minY) * scale,
  }, object)).map((point) => ({ ...point, source: 'text' })));
};

const makeCalibrationPaths = (settings) => {
  const x = settings.originX + settings.penOffsetX;
  const y = settings.originY + settings.penOffsetY;
  const w = Math.min(50, settings.paperWidth);
  const h = Math.min(50, settings.paperHeight);
  return [
    [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }],
    [{ x, y }, { x: x + w, y: y + h }],
    [{ x: x + w, y }, { x, y: y + h }],
    [{ x: x + w / 2, y }, { x: x + w / 2, y: y + h }],
    [{ x, y: y + h / 2 }, { x: x + w, y: y + h / 2 }],
    [{ x: x + w + 8, y }, { x: x + w + 8, y: y + 16 }],
    [{ x: x + w + 2, y: y + 8 }, { x: x + w + 14, y: y + 8 }],
  ];
};

const cleanPaths = (paths) => (Array.isArray(paths) ? paths : [])
  .filter((path) => Array.isArray(path) && path.length > 0)
  .map((path) => path.filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y)))
  .filter((path) => path.length > 0);

const applySettings = (paths, settings, { mirrorOutput = true } = {}) => cleanPaths(paths).map((path) => path.map((point) => {
  const scaledX = settings.originX + (point.x - settings.originX) * settings.scale;
  const scaledY = settings.originY + (point.y - settings.originY) * settings.scale;
  const paperRight = settings.originX + settings.paperWidth * settings.scale;
  const paperBottom = settings.originY + settings.paperHeight * settings.scale;
  const x = mirrorOutput && settings.mirrorOutputX ? paperRight - (scaledX - settings.originX) : scaledX;
  const y = mirrorOutput && settings.mirrorOutputY ? paperBottom - (scaledY - settings.originY) : scaledY;
  return {
    x,
    y,
  };
}));

const penToNozzlePoint = (point, settings) => ({
  x: point.x - settings.penTipOffsetX + settings.penOffsetX,
  y: point.y - settings.penTipOffsetY + settings.penOffsetY,
});

const getReachableBounds = (settings) => ({
  minX: Math.max(0, settings.penTipOffsetX),
  minY: Math.max(0, settings.penTipOffsetY),
  maxX: Math.min(settings.bedWidth, settings.bedWidth + settings.penTipOffsetX),
  maxY: Math.min(settings.bedHeight, settings.bedHeight + settings.penTipOffsetY),
});

const clampPaperToReachableArea = (settings) => {
  const bounds = getReachableBounds(settings);
  const paperWidth = Math.min(settings.paperWidth, Math.max(1, bounds.maxX - bounds.minX));
  const paperHeight = Math.min(settings.paperHeight, Math.max(1, bounds.maxY - bounds.minY));
  return {
    ...settings,
    paperWidth,
    paperHeight,
    originX: Math.max(bounds.minX, Math.min(bounds.maxX - paperWidth, settings.originX)),
    originY: Math.max(bounds.minY, Math.min(bounds.maxY - paperHeight, settings.originY)),
  };
};

const toPathData = (path) => cleanPaths([path])[0]?.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ') || '';

const estimateDistance = (paths) => cleanPaths(paths).reduce((total, path) => total + path.slice(1).reduce((sum, point, index) => {
  const previous = path[index];
  return sum + Math.hypot(point.x - previous.x, point.y - previous.y);
}, 0), 0);

const playbackPathsAtProgress = (paths, progress) => {
  const cleaned = cleanPaths(paths);
  const target = estimateDistance(cleaned) * progress;
  const out = [];
  let drawn = 0;

  for (const path of cleaned) {
    if (path.length < 2) continue;
    const nextPath = [path[0]];
    for (let index = 1; index < path.length; index += 1) {
      const previous = path[index - 1];
      const current = path[index];
      const segmentLength = distance(previous, current);
      if (drawn + segmentLength <= target) {
        nextPath.push(current);
        drawn += segmentLength;
        continue;
      }
      const remaining = Math.max(0, target - drawn);
      if (remaining > 0 && segmentLength > 0) {
        const t = remaining / segmentLength;
        nextPath.push({
          x: previous.x + (current.x - previous.x) * t,
          y: previous.y + (current.y - previous.y) * t,
        });
      }
      if (nextPath.length > 1) out.push(nextPath);
      return out;
    }
    if (nextPath.length > 1) out.push(nextPath);
  }

  return out;
};

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const simplifyPath = (path, tolerance = 0.002) => {
  if (path.length <= 2) return path;
  const simplified = [path[0]];
  let anchor = path[0];
  for (let index = 1; index < path.length - 1; index += 1) {
    const point = path[index];
    if (distance(anchor, point) >= tolerance) {
      simplified.push(point);
      anchor = point;
    }
  }
  simplified.push(path[path.length - 1]);
  return simplified;
};

const traceEdgePolylines = (sampleWidth, sampleHeight, isEdge, maxPaths = 4000) => {
  const keyFor = (x, y) => `${x},${y}`;
  const edgePixels = new Set();
  for (let y = 1; y < sampleHeight - 1; y += 1) {
    for (let x = 1; x < sampleWidth - 1; x += 1) {
      if (isEdge(x, y)) edgePixels.add(keyFor(x, y));
    }
  }

  const visited = new Set();
  const paths = [];
  const neighbors = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

  edgePixels.forEach((startKey) => {
    if (visited.has(startKey) || paths.length >= maxPaths) return;
    const [startX, startY] = startKey.split(',').map(Number);
    const stack = [[startX, startY]];
    const component = [];
    visited.add(startKey);

    while (stack.length) {
      const [x, y] = stack.pop();
      component.push([x, y]);
      neighbors.forEach(([dx, dy]) => {
        const nextKey = keyFor(x + dx, y + dy);
        if (edgePixels.has(nextKey) && !visited.has(nextKey)) {
          visited.add(nextKey);
          stack.push([x + dx, y + dy]);
        }
      });
    }

    if (component.length < 3) return;
    const cx = component.reduce((sum, point) => sum + point[0], 0) / component.length;
    const cy = component.reduce((sum, point) => sum + point[1], 0) / component.length;
    const path = component
      .sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx))
      .map(([x, y]) => ({ x: x / sampleWidth, y: y / sampleHeight }));
    if (distance(path[0], path[path.length - 1]) < 0.08) path.push(path[0]);
    paths.push(simplifyPath(path, 0.003));
  });

  return paths;
};

const segmentKey = (a, b, precision = 1) => {
  const p1 = `${a.x.toFixed(precision)},${a.y.toFixed(precision)}`;
  const p2 = `${b.x.toFixed(precision)},${b.y.toFixed(precision)}`;
  return p1 < p2 ? `${p1}|${p2}` : `${p2}|${p1}`;
};

const removeDuplicateSegments = (paths) => {
  const seen = new Set();
  const cleaned = [];

  cleanPaths(paths).forEach((path) => {
    const rebuilt = [path[0]];
    for (let index = 1; index < path.length; index += 1) {
      const previous = path[index - 1];
      const current = path[index];
      if (distance(previous, current) < 0.05) continue;
      const key = segmentKey(previous, current);
      if (seen.has(key)) {
        if (rebuilt.length > 1) {
          cleaned.push([...rebuilt]);
          rebuilt.length = 0;
        }
        rebuilt.push(current);
        continue;
      }
      seen.add(key);
      if (rebuilt.length === 0) rebuilt.push(previous);
      rebuilt.push(current);
    }
    if (rebuilt.length > 1) cleaned.push(rebuilt);
  });

  return cleaned;
};

const optimizePaths = (paths) => {
  const remaining = removeDuplicateSegments(paths).filter((path) => path.length > 1).map((path) => [...path]);
  const ordered = [];
  let pen = { x: 0, y: 0 };
  while (remaining.length) {
    let bestIndex = 0;
    let bestReverse = false;
    let bestDistance = Infinity;
    remaining.forEach((path, index) => {
      const startDistance = distance(pen, path[0]);
      const endDistance = distance(pen, path[path.length - 1]);
      if (startDistance < bestDistance) {
        bestIndex = index;
        bestReverse = false;
        bestDistance = startDistance;
      }
      if (endDistance < bestDistance) {
        bestIndex = index;
        bestReverse = true;
        bestDistance = endDistance;
      }
    });
    const [next] = remaining.splice(bestIndex, 1);
    const path = bestReverse ? next.reverse() : next;
    ordered.push(path);
    pen = path[path.length - 1];
  }
  return ordered;
};

const orderPathsForExport = (paths, { preserveOrder = false } = {}) => {
  if (preserveOrder) return cleanPaths(paths).filter((path) => path.length > 1);
  const cleaned = removeDuplicateSegments(paths).filter((path) => path.length > 1);
  return optimizePaths(cleaned);
};

const makeHatchPaths = (settings, angle = 0, spacing = 6) => {
  const paths = [];
  const x0 = settings.originX;
  const y0 = settings.originY;
  const w = settings.paperWidth;
  const h = settings.paperHeight;
  if (angle === 90) {
    for (let x = x0; x <= x0 + w; x += spacing) paths.push([{ x, y: y0 }, { x, y: y0 + h }]);
    return paths;
  }
  if (angle === 45) {
    for (let i = -h; i < w; i += spacing) paths.push([{ x: x0 + Math.max(i, 0), y: y0 + Math.max(-i, 0) }, { x: x0 + Math.min(w, i + h), y: y0 + Math.min(h, h - Math.max(i, 0)) }]);
    return paths;
  }
  for (let y = y0; y <= y0 + h; y += spacing) paths.push([{ x: x0, y }, { x: x0 + w, y }]);
  return paths;
};

const makeSpiralPaths = (settings) => {
  const cx = settings.originX + settings.paperWidth / 2;
  const cy = settings.originY + settings.paperHeight / 2;
  const maxR = Math.min(settings.paperWidth, settings.paperHeight) * 0.42;
  const points = [];
  for (let t = 0; t < Math.PI * 18; t += 0.18) {
    const r = (t / (Math.PI * 18)) * maxR;
    points.push({ x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r });
  }
  return [points];
};

const makeFlowPaths = (settings) => {
  const paths = [];
  for (let row = 0; row < 18; row += 1) {
    const y = settings.originY + 12 + row * (settings.paperHeight - 24) / 17;
    const path = [];
    for (let x = settings.originX + 10; x <= settings.originX + settings.paperWidth - 10; x += 6) {
      path.push({ x, y: y + Math.sin(x * 0.08 + row * 0.7) * 7 + Math.sin(x * 0.025) * 4 });
    }
    paths.push(path);
  }
  return paths;
};

const makeContourPaths = (settings) => {
  const paths = [];
  const cx = settings.originX + settings.paperWidth / 2;
  const cy = settings.originY + settings.paperHeight / 2;
  for (let ring = 1; ring <= 10; ring += 1) {
    const points = [];
    const base = ring * Math.min(settings.paperWidth, settings.paperHeight) / 24;
    for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.18) {
      const r = base + Math.sin(a * 5 + ring) * 3 + Math.cos(a * 3) * 2;
      points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    paths.push(points);
  }
  return paths;
};

const normalizePathsToObjectLocal = (paths) => {
  const points = paths.flat();
  if (!points.length) return [];
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);
  return paths.map((path) => path.map((point) => ({
    x: (point.x - minX) / w,
    y: (point.y - minY) / h,
  })));
};

const sampleSvgGeometry = (element, steps = 160) => {
  if (!element.getTotalLength) return [];
  const total = element.getTotalLength();
  if (!Number.isFinite(total) || total <= 0) return [];
  const count = Math.max(2, Math.min(steps, Math.ceil(total / 2)));
  const path = [];
  for (let i = 0; i <= count; i += 1) {
    const point = element.getPointAtLength((total * i) / count);
    path.push({ x: point.x, y: point.y });
  }
  return path;
};

function App() {
  const [mode, setMode] = useState('text');
  const [photoMode, setPhotoMode] = useState('image');
  const [textItems, setTextItems] = useState([createTextItem('text-1')]);
  const [selectedTextId, setSelectedTextId] = useState('text-1');
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageName, setImageName] = useState('');
  const [traceThreshold, setTraceThreshold] = useState(130);
  const [traceSpacing, setTraceSpacing] = useState(3);
  const [traceDetail, setTraceDetail] = useState(280);
  const [traceInvert, setTraceInvert] = useState(false);
  const [traceMode, setTraceMode] = useState('hatching');
  const [svgName, setSvgName] = useState('');
  const [importedSvgPaths, setImportedSvgPaths] = useState([]);
  const [svgFillPaths, setSvgFillPaths] = useState([]);
  const [fillHoles, setFillHoles] = useState(false);
  const [qrText, setQrText] = useState('https://example.com');
  const [qrStyle, setQrStyle] = useState('dots');
  const [qrFilled, setQrFilled] = useState(false);
  const [qrPaths, setQrPaths] = useState([]);
  const [patternType, setPatternType] = useState('hatching');
  const [drawPaths, setDrawPaths] = useState([]);
  const [imageLocalPaths, setImageLocalPaths] = useState([]);
  const [layers, setLayers] = useState([]);
  const [objectVisibility, setObjectVisibility] = useState({
    text: true,
    image: true,
    svg: true,
    qr: true,
    draw: true,
    generated: true,
  });
  const [settings, setSettings] = useState(() => clampPaperToReachableArea(defaultSettings));
  const [object, setObject] = useState(defaultObject);
  const [printerConfig, setPrinterConfig] = useState(loadPrinterConfig);
  const [printerStatus, setPrinterStatus] = useState({ connected: false, lastReport: null });
  const [printerMessage, setPrinterMessage] = useState('Backend not checked yet.');
  const [discoveryBusy, setDiscoveryBusy] = useState(false);
  const [preflightMessage, setPreflightMessage] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [printerDetailsOpen, setPrinterDetailsOpen] = useState(true);
  const [motionOpen, setMotionOpen] = useState(false);
  const [sendConfirmed, setSendConfirmed] = useState(false);
  const [zConfirmed, setZConfirmed] = useState(false);
  const [tapToMoveActive, setTapToMoveActive] = useState(false);
  const [tapToMoveMarker, setTapToMoveMarker] = useState(null);
  const [toolheadFanOn, setToolheadFanOn] = useState(false);
  const [homeBeforeDirectSend] = useState(false);
  const [preserveZZero, setPreserveZZero] = useState(true);
  const [bambuSafetyHeader, setBambuSafetyHeader] = useState(true);
  const [lineNumbersEnabled, setLineNumbersEnabled] = useState(false);
  const [lineDelayMs, setLineDelayMs] = useState(300);
  const [preparedJob, setPreparedJob] = useState(null);
  const [mqttViewerOpen, setMqttViewerOpen] = useState(false);
  const [mqttLogEntries, setMqttLogEntries] = useState([]);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState({ message: '', latestVersion: '', updateAvailable: false });
  const [updateBusy, setUpdateBusy] = useState(false);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [playbackOpen, setPlaybackOpen] = useState(false);
  const [playbackPlaying, setPlaybackPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const mqttLastId = useRef(0);
  const mqttLogRef = useRef(null);
  const dragMode = useRef(null);
  const dragStart = useRef({ x: 0, y: 0, object: defaultObject, settings: defaultSettings, textItems: [], textId: null });
  const activeDrawPath = useRef(null);
  const activeDrawIndex = useRef(null);
  const drawFrame = useRef(null);
  const tapToMoveMarkerTimeout = useRef(null);
  const autoDiscoveryTried = useRef(false);
  const selectedText = textItems.find((item) => item.id === selectedTextId) || textItems[0];
  const unsupportedChars = useMemo(() => unsupportedTextChars(textItems), [textItems]);
  const compressedTexts = useMemo(() => compressedTextItems(textItems), [textItems]);

  const textPaths = useMemo(() => textItems.flatMap((item) => makeTextPaths(item.text, item.object, item.fontKey)), [textItems]);
  const svgPaths = useMemo(() => [...importedSvgPaths, ...svgFillPaths]
    .map((path) => path.map((point) => transformLocalPoint({
      x: point.x * object.w,
      y: point.y * object.h,
    }, object))), [importedSvgPaths, object, svgFillPaths]);
  const transformedQrPaths = useMemo(() => {
    const size = Math.min(object.w, object.h);
    const offsetX = (object.w - size) / 2;
    const offsetY = (object.h - size) / 2;
    return qrPaths.map((path) => path.map((point) => transformLocalPoint({
      x: offsetX + point.x * size,
      y: offsetY + point.y * size,
    }, object)));
  }, [object, qrPaths]);
  const imagePaths = useMemo(() => (
    imageLocalPaths.map((path) => path.map((point) => transformLocalPoint({
      x: point.x * object.w,
      y: point.y * object.h,
    }, object)))
  ), [imageLocalPaths, object]);
  const generatedModePaths = useMemo(() => {
    if (mode === 'patterns') {
      if (patternType === 'spiral') return makeSpiralPaths(settings);
      if (patternType === 'flow') return makeFlowPaths(settings);
      if (patternType === 'contour') return makeContourPaths(settings);
      if (patternType === 'crosshatch') return [...makeHatchPaths(settings, 0, traceSpacing), ...makeHatchPaths(settings, 90, traceSpacing)];
      return makeHatchPaths(settings, patternType === 'diagonal' ? 45 : 0, traceSpacing);
    }
    if (mode === 'calibrate') return makeCalibrationPaths(settings);
    return [];
  }, [mode, patternType, settings, traceSpacing]);
  const projectPaths = useMemo(() => cleanPaths([
    ...(objectVisibility.text ? textPaths : []),
    ...(objectVisibility.image ? imagePaths : []),
    ...(objectVisibility.svg ? svgPaths : []),
    ...(objectVisibility.qr ? transformedQrPaths : []),
    ...(objectVisibility.draw ? drawPaths : []),
    ...(objectVisibility.generated ? generatedModePaths : []),
  ]), [drawPaths, generatedModePaths, imagePaths, objectVisibility, svgPaths, textPaths, transformedQrPaths]);
  const workingPaths = useMemo(() => {
    if (mode === 'text') return textPaths;
    if (mode === 'photos' && photoMode === 'image') return imagePaths;
    if (mode === 'photos' && photoMode === 'svg') return svgPaths;
    if (mode === 'qr') return transformedQrPaths;
    if (mode === 'draw') return cleanPaths(drawPaths);
    return generatedModePaths;
  }, [drawPaths, generatedModePaths, imagePaths, mode, photoMode, svgPaths, textPaths, transformedQrPaths]);

  const enabledLayerPaths = useMemo(() => layers.filter((layer) => layer.enabled).sort((a, b) => a.order - b.order).flatMap((layer) => layer.paths), [layers]);
  const enabledLayers = useMemo(() => layers.filter((layer) => layer.enabled).sort((a, b) => a.order - b.order), [layers]);
  const exportSourcePaths = enabledLayerPaths.length ? enabledLayerPaths : projectPaths;
  const exportPaths = useMemo(() => orderPathsForExport(applySettings(exportSourcePaths, settings), { preserveOrder: mode === 'text' }), [exportSourcePaths, mode, settings]);
  const stats = useMemo(() => ({
    paths: exportPaths.length,
    points: exportPaths.reduce((sum, path) => sum + path.length, 0),
    distance: estimateDistance(exportPaths),
  }), [exportPaths]);
  const objectRows = useMemo(() => [
    { key: 'text', label: 'Text', count: textPaths.length },
    { key: 'image', label: 'Image', count: imagePaths.length },
    { key: 'svg', label: 'SVG', count: svgPaths.length },
    { key: 'qr', label: 'QR', count: transformedQrPaths.length },
    { key: 'draw', label: 'Drawing', count: drawPaths.length },
    { key: 'generated', label: 'Generated', count: generatedModePaths.length },
  ], [drawPaths.length, generatedModePaths.length, imagePaths.length, svgPaths.length, textPaths.length, transformedQrPaths.length]);
  const playbackSourcePaths = useMemo(() => orderPathsForExport(applySettings(exportSourcePaths, settings, { mirrorOutput: false }), { preserveOrder: mode === 'text' }), [exportSourcePaths, mode, settings]);
  const playbackPreviewPaths = useMemo(() => playbackPathsAtProgress(playbackSourcePaths, playbackProgress), [playbackSourcePaths, playbackProgress]);

  const sliceSignature = useMemo(() => JSON.stringify({
    paths: exportPaths.map((path) => path.map((point) => [Number(point.x.toFixed(2)), Number(point.y.toFixed(2))])),
    settings: {
      safeZ: settings.safeZ,
      penUpZ: settings.penUpZ,
      penDownZ: settings.penDownZ,
      feedrate: settings.feedrate,
      travelSpeed: settings.travelSpeed,
      parkX: settings.parkX,
      parkY: settings.parkY,
      penTipOffsetX: settings.penTipOffsetX,
      penTipOffsetY: settings.penTipOffsetY,
      penOffsetX: settings.penOffsetX,
      penOffsetY: settings.penOffsetY,
      mirrorOutputX: settings.mirrorOutputX,
      mirrorOutputY: settings.mirrorOutputY,
    },
    homeBeforeDirectSend,
    zConfirmed,
    preserveZZero,
    bambuSafetyHeader,
    lineNumbersEnabled,
  }), [bambuSafetyHeader, exportPaths, homeBeforeDirectSend, lineNumbersEnabled, preserveZZero, settings.feedrate, settings.mirrorOutputX, settings.mirrorOutputY, settings.parkX, settings.parkY, settings.penDownZ, settings.penOffsetX, settings.penOffsetY, settings.penTipOffsetX, settings.penTipOffsetY, settings.penUpZ, settings.safeZ, settings.travelSpeed, zConfirmed]);
  const preparedJobIsFresh = preparedJob?.signature === sliceSignature;
  const unreachableZones = useMemo(() => {
    const zones = [];
    if (settings.penTipOffsetX > 0) zones.push({ x: 0, y: 0, width: settings.penTipOffsetX, height: settings.bedHeight });
    if (settings.penTipOffsetX < 0) zones.push({ x: settings.bedWidth + settings.penTipOffsetX, y: 0, width: Math.abs(settings.penTipOffsetX), height: settings.bedHeight });
    if (settings.penTipOffsetY > 0) zones.push({ x: 0, y: 0, width: settings.bedWidth, height: settings.penTipOffsetY });
    if (settings.penTipOffsetY < 0) zones.push({ x: 0, y: settings.bedHeight + settings.penTipOffsetY, width: settings.bedWidth, height: Math.abs(settings.penTipOffsetY) });
    return zones.filter((zone) => zone.width > 0 && zone.height > 0);
  }, [settings.bedHeight, settings.bedWidth, settings.penTipOffsetX, settings.penTipOffsetY]);

  const handlePresetChange = (presetKey) => {
    const preset = PRESETS[presetKey];
    setSettings((current) => clampPaperToReachableArea({
      ...current,
      preset: presetKey,
      bedWidth: preset.bedWidth,
      bedHeight: preset.bedHeight,
      paperWidth: preset.paperWidth,
      paperHeight: preset.paperHeight,
      feedrate: preset.feedrate,
      travelSpeed: preset.travelSpeed,
      parkY: preset.bedHeight,
    }));
  };

  const handleSettingChange = (key, value) => {
    setSettings((current) => clampPaperToReachableArea({
      ...current,
      preset: ['bedWidth', 'bedHeight'].includes(key) ? 'custom' : current.preset,
      [key]: value,
    }));
  };

  const addWorkingLayer = () => {
    if (!workingPaths.length) return;
    const layer = {
      id: crypto.randomUUID(),
      name: `${mode} ${layers.length + 1}`,
      type: mode,
      color: colors[layers.length % colors.length],
      enabled: true,
      order: layers.length,
      paths: workingPaths,
    };
    setLayers((current) => [...current, layer]);
  };

  const updateLayer = (id, patch) => {
    setLayers((current) => current.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)));
  };

  const moveLayer = (id, direction) => {
    setLayers((current) => {
      const sorted = [...current].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((layer) => layer.id === id);
      const swapIndex = index + direction;
      if (swapIndex < 0 || swapIndex >= sorted.length) return current;
      [sorted[index], sorted[swapIndex]] = [sorted[swapIndex], sorted[index]];
      return sorted.map((layer, order) => ({ ...layer, order }));
    });
  };

  const updateTextItem = (id, patch) => {
    setTextItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const updateTextObject = (id, nextObject) => {
    setTextItems((current) => current.map((item) => (item.id === id ? { ...item, object: nextObject } : item)));
  };

  const addTextItem = () => {
    const id = crypto.randomUUID();
    const next = createTextItem(id, textItems.length);
    setTextItems((current) => [...current, next]);
    setSelectedTextId(id);
  };

  const removeSelectedText = () => {
    if (textItems.length <= 1) return;
    setTextItems((current) => {
      const next = current.filter((item) => item.id !== selectedTextId);
      setSelectedTextId(next[0].id);
      return next;
    });
  };

  const traceImage = (url, threshold = traceThreshold, spacing = traceSpacing, modeName = traceMode, detail = traceDetail, invert = traceInvert) => {
    const image = new Image();
    image.onload = () => {
      const sampleWidth = detail;
      const sampleHeight = Math.max(1, Math.round((image.height / image.width) * sampleWidth));
      const canvas = document.createElement('canvas');
      canvas.width = sampleWidth;
      canvas.height = sampleHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0, sampleWidth, sampleHeight);
      const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
      const darkAt = (x, y) => {
        const i = (Math.max(0, Math.min(sampleHeight - 1, y)) * sampleWidth + Math.max(0, Math.min(sampleWidth - 1, x))) * 4;
        const luminance = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
        const dark = invert ? luminance > threshold : luminance < threshold;
        return dark && pixels[i + 3] > 20;
      };
      const luminanceAt = (x, y) => {
        const i = (Math.max(0, Math.min(sampleHeight - 1, y)) * sampleWidth + Math.max(0, Math.min(sampleWidth - 1, x))) * 4;
        const luminance = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
        return invert ? 255 - luminance : luminance;
      };
      const localPaths = [];
      const pixelSizeMm = Math.max(object.h / sampleHeight, 0.03);
      const step = Math.max(1, Math.round(spacing / pixelSizeMm));

      if (modeName === 'stipple') {
        for (let y = 0; y < sampleHeight; y += step) {
          for (let x = 0; x < sampleWidth; x += step) {
            if (darkAt(x, y)) localPaths.push([{ x: x / sampleWidth, y: y / sampleHeight }, { x: (x + 0.8) / sampleWidth, y: (y + 0.8) / sampleHeight }]);
          }
        }
      } else if (modeName === 'connected-outline') {
        const edgeLimit = Math.max(18, 255 - threshold);
        localPaths.push(...traceEdgePolylines(sampleWidth, sampleHeight, (x, y) => {
          const thresholdEdge = darkAt(x, y) && (!darkAt(x + 1, y) || !darkAt(x - 1, y) || !darkAt(x, y + 1) || !darkAt(x, y - 1));
          const gx = Math.abs(luminanceAt(x + 1, y) - luminanceAt(x - 1, y));
          const gy = Math.abs(luminanceAt(x, y + 1) - luminanceAt(x, y - 1));
          return thresholdEdge || gx + gy > edgeLimit;
        }));
      } else if (modeName === 'fine-outline') {
        const edgeLimit = Math.max(18, 255 - threshold);
        for (let y = 1; y < sampleHeight - 1; y += 1) {
          for (let x = 1; x < sampleWidth - 1; x += 1) {
            const gx = Math.abs(luminanceAt(x + 1, y) - luminanceAt(x - 1, y));
            const gy = Math.abs(luminanceAt(x, y + 1) - luminanceAt(x, y - 1));
            if (gx + gy > edgeLimit) localPaths.push([{ x: x / sampleWidth, y: y / sampleHeight }, { x: (x + 0.9) / sampleWidth, y: y / sampleHeight }]);
          }
        }
      } else if (modeName === 'outline') {
        for (let y = 1; y < sampleHeight - 1; y += 1) {
          for (let x = 1; x < sampleWidth - 1; x += 1) {
            const edge = darkAt(x, y) && (!darkAt(x + 1, y) || !darkAt(x - 1, y) || !darkAt(x, y + 1) || !darkAt(x, y - 1));
            if (edge) localPaths.push([{ x: x / sampleWidth, y: y / sampleHeight }, { x: (x + 0.9) / sampleWidth, y: y / sampleHeight }]);
          }
        }
      } else {
        const diagonal = modeName === 'sketch';
        for (let y = 0; y < sampleHeight; y += step) {
          let runStart = null;
          for (let x = 0; x < sampleWidth; x += 1) {
            const dark = darkAt(x, y);
            if (dark && runStart === null) runStart = x;
            if ((!dark || x === sampleWidth - 1) && runStart !== null) {
              const runEnd = dark ? x : x - 1;
              if (runEnd - runStart > 2) {
                localPaths.push([
                  { x: runStart / sampleWidth, y: y / sampleHeight },
                  { x: runEnd / sampleWidth, y: (y + (diagonal ? step : 0)) / sampleHeight },
                ]);
              }
              runStart = null;
            }
          }
        }
      }

      setImageLocalPaths(localPaths);
    };
    image.src = url;
  };

  const handleAssetFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      file.text().then((text) => importSvg(text, file.name));
      return;
    }
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setImageName(file.name);
      setPhotoMode('image');
      setMode('photos');
      traceImage(url);
    }
  };

  const importSvg = (source, name) => {
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    tempSvg.setAttribute('width', '0');
    tempSvg.setAttribute('height', '0');
    tempSvg.style.position = 'absolute';
    tempSvg.style.opacity = '0';
    document.body.appendChild(tempSvg);

    const paths = [];
    doc.querySelectorAll('path,line,polyline,polygon,rect,circle,ellipse').forEach((node) => {
      const element = document.createElementNS('http://www.w3.org/2000/svg', node.tagName.toLowerCase());
      [...node.attributes].forEach((attr) => element.setAttribute(attr.name, attr.value));
      if (node.tagName.toLowerCase() === 'line') element.setAttribute('d', `M ${node.getAttribute('x1') || 0} ${node.getAttribute('y1') || 0} L ${node.getAttribute('x2') || 0} ${node.getAttribute('y2') || 0}`);
      tempSvg.appendChild(element);
      const sampled = sampleSvgGeometry(element);
      if (sampled.length) paths.push(sampled);
    });

    const fillPaths = fillHoles ? makeSvgFillPaths(doc, tempSvg) : [];
    document.body.removeChild(tempSvg);
    setSvgName(name);
    setImportedSvgPaths(normalizePathsToObjectLocal(paths));
    setSvgFillPaths(normalizePathsToObjectLocal(fillPaths));
    setPhotoMode('svg');
    setMode('photos');
  };

  const makeSvgFillPaths = (doc, tempSvg) => {
    const fillPaths = [];
    doc.querySelectorAll('path,rect,circle,ellipse,polygon').forEach((node) => {
      const element = document.createElementNS('http://www.w3.org/2000/svg', node.tagName.toLowerCase());
      [...node.attributes].forEach((attr) => element.setAttribute(attr.name, attr.value));
      tempSvg.appendChild(element);
      if (!element.getBBox || !element.isPointInFill) return;
      const box = element.getBBox();
      for (let y = box.y; y <= box.y + box.height; y += traceSpacing) {
        let runStart = null;
        for (let x = box.x; x <= box.x + box.width; x += 2) {
          const inside = element.isPointInFill(new DOMPoint(x, y));
          if (inside && runStart === null) runStart = x;
          if ((!inside || x >= box.x + box.width - 2) && runStart !== null) {
            const runEnd = inside ? x : x - 2;
            if (runEnd - runStart > 2) fillPaths.push([{ x: runStart, y }, { x: runEnd, y }]);
            runStart = null;
          }
        }
      }
    });
    return fillPaths;
  };

  const generateQr = async () => {
    const qr = QRCode.create(qrText || ' ', { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const moduleSize = 1 / size;
    const paths = [];
    const fillModule = (x, y) => {
      const fillLines = qrStyle === 'rounded'
        ? ['0.32,0.24 0.68,0.24', '0.22,0.38 0.78,0.38', '0.2,0.5 0.8,0.5', '0.22,0.62 0.78,0.62', '0.32,0.76 0.68,0.76']
        : ['0,0.18 1,0.18', '0,0.34 1,0.34', '0,0.5 1,0.5', '0,0.66 1,0.66', '0,0.82 1,0.82'];
      fillLines.forEach((line) => paths.push(parseStroke(line, x, y, moduleSize, moduleSize)));
    };
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (!qr.modules.get(row, col)) continue;
        const x = col * moduleSize;
        const y = row * moduleSize;
        if (qrStyle === 'dots') {
          paths.push(parseStroke('0.2,0.5 0.8,0.5', x, y, moduleSize, moduleSize));
        } else if (qrStyle === 'rounded') {
          paths.push(parseStroke('0.2,0.2 0.8,0.2 0.8,0.8 0.2,0.8 0.2,0.2', x, y, moduleSize, moduleSize));
          if (qrFilled) fillModule(x, y);
        } else {
          paths.push(parseStroke('0,0 1,0 1,1 0,1 0,0', x, y, moduleSize, moduleSize));
          if (qrFilled) fillModule(x, y);
        }
      }
    }
    setQrPaths(paths);
  };

  const svgPointFromEvent = (event) => {
    const svg = document.getElementById('build-plate-svg');
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * settings.bedWidth,
      y: ((event.clientY - rect.top) / rect.height) * settings.bedHeight,
    };
  };

  const handleTapToMove = async (point) => {
    const bounds = getReachableBounds(settings);
    const clamped = {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y)),
    };
    const nozzle = penToNozzlePoint(clamped, settings);
    setTapToMoveMarker(clamped);
    if (tapToMoveMarkerTimeout.current) clearTimeout(tapToMoveMarkerTimeout.current);
    tapToMoveMarkerTimeout.current = setTimeout(() => setTapToMoveMarker(null), 1500);
    await callPrinterApi('/api/printer/move-absolute', {
      x: nozzle.x, y: nozzle.y, z: settings.safeZ,
      feedrate: settings.travelSpeed, confirmed: zConfirmed,
    });
  };

  const handlePointerDown = (event) => {
    const point = svgPointFromEvent(event);
    if (tapToMoveActive && printerStatus.connected) {
      const svg = document.getElementById('build-plate-svg');
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const pt = svg.createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;
        const svgP = pt.matrixTransform(ctm.inverse());
        handleTapToMove({ x: svgP.x, y: svgP.y });
      }
      return;
    }
    if (mode === 'draw') {
      activeDrawPath.current = [point];
      setDrawPaths((paths) => {
        activeDrawIndex.current = paths.length;
        return [...paths, [point]];
      });
      return;
    }
    if (event.target.dataset.handle === 'paper-resize') {
      if (!presetMenuOpen) return;
      dragMode.current = 'paper-resize';
      dragStart.current = { x: point.x, y: point.y, settings };
      return;
    }
    if (event.target.dataset.paper === 'true') {
      if (!presetMenuOpen) return;
      dragMode.current = 'paper';
      dragStart.current = {
        x: point.x,
        y: point.y,
        object,
        settings,
        textItems,
        textId: null,
      };
      return;
    }
    const textId = event.target.dataset.textId;
    const textObject = textItems.find((item) => item.id === textId)?.object || selectedText?.object || defaultObject;
    if (mode === 'text' && textId) setSelectedTextId(textId);
    if (event.target.dataset.handle === 'resize') dragMode.current = 'resize';
    else if (event.target.dataset.handle === 'rotate') dragMode.current = 'rotate';
    else dragMode.current = 'move';
    dragStart.current = {
      x: point.x,
      y: point.y,
      object: mode === 'text' ? textObject : object,
      textId: mode === 'text' ? (textId || selectedText?.id) : null,
    };
  };

  const handlePointerMove = (event) => {
    if (tapToMoveActive) return;
    const point = svgPointFromEvent(event);
    if (mode === 'draw' && activeDrawPath.current) {
      const path = activeDrawPath.current;
      const previous = path[path.length - 1];
      if (!previous || distance(previous, point) < DRAW_MIN_DISTANCE_MM || path.length >= DRAW_MAX_POINTS_PER_STROKE) return;
      path.push(point);
      if (drawFrame.current) return;
      drawFrame.current = requestAnimationFrame(() => {
        drawFrame.current = null;
        setDrawPaths((paths) => {
          const next = [...paths];
          const index = activeDrawIndex.current;
          if (index !== null && next[index]) next[index] = [...activeDrawPath.current];
          return next;
        });
      });
      return;
    }
    if (!dragMode.current) return;
    const start = dragStart.current;
    if (dragMode.current === 'paper') {
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      const nextSettings = clampPaperToReachableArea({
        ...start.settings,
        originX: start.settings.originX + dx,
        originY: start.settings.originY + dy,
      });
      const { originX, originY } = nextSettings;
      const clampedDx = originX - start.settings.originX;
      const clampedDy = originY - start.settings.originY;
      setSettings((current) => ({ ...current, originX, originY }));
      setObject({ ...start.object, x: start.object.x + clampedDx, y: start.object.y + clampedDy });
      setTextItems(start.textItems.map((item) => ({
        ...item,
        object: { ...item.object, x: item.object.x + clampedDx, y: item.object.y + clampedDy },
      })));
      return;
    }
    if (dragMode.current === 'paper-resize') {
      const newW = Math.max(10, point.x - start.settings.originX);
      const newH = Math.max(10, point.y - start.settings.originY);
      const next = clampPaperToReachableArea({
        ...start.settings,
        paperWidth: newW,
        paperHeight: newH,
      });
      setSettings((current) => ({ ...current, paperWidth: next.paperWidth, paperHeight: next.paperHeight, preset: 'custom' }));
      return;
    }
    const commitObject = (nextObject) => {
      if (mode === 'text' && start.textId) updateTextObject(start.textId, nextObject);
      else setObject(nextObject);
    };
    if (dragMode.current === 'move') commitObject({ ...start.object, x: Math.max(0, start.object.x + point.x - start.x), y: Math.max(0, start.object.y + point.y - start.y) });
    if (dragMode.current === 'resize') commitObject({ ...start.object, w: Math.max(12, point.x - start.object.x), h: Math.max(12, point.y - start.object.y) });
    if (dragMode.current === 'rotate') {
      const cx = start.object.x + start.object.w / 2;
      const cy = start.object.y + start.object.h / 2;
      commitObject({ ...start.object, angle: Math.atan2(point.y - cy, point.x - cx) * (180 / Math.PI) });
    }
  };

  const handlePointerUp = () => {
    if (tapToMoveActive) return;
    dragMode.current = null;
    if (drawFrame.current) {
      cancelAnimationFrame(drawFrame.current);
      drawFrame.current = null;
    }
    if (activeDrawPath.current && activeDrawIndex.current !== null) {
      const finalPath = [...activeDrawPath.current];
      setDrawPaths((paths) => {
        const next = [...paths];
        if (finalPath.length < 2) next.splice(activeDrawIndex.current, 1);
        else next[activeDrawIndex.current] = finalPath;
        return next;
      });
    }
    activeDrawPath.current = null;
    activeDrawIndex.current = null;
  };

  const clearDrawing = () => {
    if (drawFrame.current) {
      cancelAnimationFrame(drawFrame.current);
      drawFrame.current = null;
    }
    activeDrawPath.current = null;
    activeDrawIndex.current = null;
    setDrawPaths([]);
  };

  const clearEverything = () => {
    if (drawFrame.current) {
      cancelAnimationFrame(drawFrame.current);
      drawFrame.current = null;
    }
    activeDrawPath.current = null;
    activeDrawIndex.current = null;
    setTextItems([{ ...createTextItem('text-1'), text: '' }]);
    setSelectedTextId('text-1');
    setPreviewUrl('');
    setImageName('');
    setImageLocalPaths([]);
    setSvgName('');
    setImportedSvgPaths([]);
    setSvgFillPaths([]);
    setQrPaths([]);
    setDrawPaths([]);
    setLayers([]);
    setObjectVisibility({ text: true, image: true, svg: true, qr: true, draw: true, generated: true });
    setPreparedJob(null);
    setPreflightMessage('');
  };

  const clearObjectGroup = (key) => {
    if (key === 'text') {
      const resetText = createTextItem('text-1');
      setTextItems([{ ...resetText, text: '' }]);
      setSelectedTextId('text-1');
    }
    if (key === 'image') {
      setPreviewUrl('');
      setImageName('');
      setImageLocalPaths([]);
    }
    if (key === 'svg') {
      setSvgName('');
      setImportedSvgPaths([]);
      setSvgFillPaths([]);
    }
    if (key === 'qr') setQrPaths([]);
    if (key === 'draw') setDrawPaths([]);
    if (key === 'generated') setMode('text');
    setPreparedJob(null);
    setPreflightMessage('');
  };

  const exportSvg = () => {
    const paths = exportPaths.map((path) => `  <path d="${toPathData(path)}" fill="none" stroke="#111827" stroke-width="0.35"/>`).join('\n');
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${settings.bedWidth}mm" height="${settings.bedHeight}mm" viewBox="0 0 ${settings.bedWidth} ${settings.bedHeight}">\n  <rect x="${settings.originX}" y="${settings.originY}" width="${settings.paperWidth}" height="${settings.paperHeight}" fill="white" stroke="#94a3b8" stroke-width="0.5"/>\n${paths}\n</svg>`;
    downloadFile(svg, 'plotter-design.svg', 'image/svg+xml');
  };

  const exportTracedImageSvg = () => {
    const paths = imageLocalPaths
      .map((path) => path.map((point) => ({ x: point.x * object.w, y: point.y * object.h })))
      .map((path) => `  <path d="${toPathData(path)}" fill="none" stroke="#111827" stroke-width="0.35"/>`)
      .join('\n');
    const filename = imageName ? `${imageName.replace(/\.[^.]+$/, '')}-traced.svg` : 'traced-image.svg';
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${object.w}mm" height="${object.h}mm" viewBox="0 0 ${object.w} ${object.h}">\n${paths}\n</svg>`;
    downloadFile(svg, filename, 'image/svg+xml');
  };

  const exportGCode = () => {
    downloadFile(buildPlotGCode(), preserveZZero ? 'pen-plotter-no-home-preserve-z0.gcode' : 'pen-plotter.gcode', 'text/plain');
  };

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const addLineNumbers = (gcode) => {
    let lineNumber = 10;
    return gcode.split('\n').map((line) => {
      if (!cleanGCodeLine(line)) return line;
      const numbered = `N${lineNumber} ${line}`;
      lineNumber += 10;
      return numbered;
    }).join('\n');
  };

  const buildPlotGCode = ({
    homeBeforePlot = settings.homeBeforePlot,
    paths = exportPaths,
    jobSettings = settings,
    useLineNumbers = lineNumbersEnabled,
    useBambuSafetyHeader = bambuSafetyHeader,
  } = {}) => {
    if (!paths.length) return '';
    let gcode = '; ===== PLOTTER STUDIO G-CODE =====\n';
    gcode += '; PEN PLOTTER MODE - NO FILAMENT EXTRUSION\n';
    gcode += `; Printer: ${PRESETS[jobSettings.preset]?.label || 'Custom'}\n`;
    gcode += `; Bed Size: ${jobSettings.bedWidth} x ${jobSettings.bedHeight}mm\n`;
    gcode += `; Pen Tip Offset From Nozzle: X=${jobSettings.penTipOffsetX}mm, Y=${jobSettings.penTipOffsetY}mm\n`;
    gcode += `; Fine Offset Compensation: X=${jobSettings.penOffsetX}mm, Y=${jobSettings.penOffsetY}mm\n`;
    gcode += '; WARNING: Manually verify pen mounting, paper hold-down, and Z height before running.\n';
    gcode += '; No extrusion moves are generated.\n';
    gcode += `; Z-Draw (pen down): ${jobSettings.penDownZ.toFixed(2)}mm\n`;
    gcode += `; Z-Lift (pen up): ${jobSettings.penUpZ.toFixed(2)}mm\n`;
    gcode += `; Draw Speed: ${jobSettings.feedrate}mm/min\n`;
    gcode += `; Travel Speed: ${jobSettings.travelSpeed}mm/min\n`;
    gcode += `; Line Numbers: ${useLineNumbers ? 'ENABLED' : 'DISABLED'}\n`;
    gcode += `; Total Paths: ${paths.length}\n\n`;
    if (preserveZZero) {
      gcode += '; Z0 PRESERVE MODE: this file assumes you already set pen Z0 on the paper.\n';
      gcode += '; Z homing is disabled so the calibrated pen height is not lost.\n';
    }

    gcode += '\n; === INITIALIZATION ===\n';
    if (useBambuSafetyHeader) {
      gcode += 'M104 S0 ; turn off nozzle heater\n';
      gcode += 'M140 S0 ; turn off bed heater\n';
      gcode += 'M107 ; turn off fan\n';
    }
    gcode += 'M17 ; enable steppers\n';
    gcode += 'G21 ; set units to millimeters\n';
    gcode += 'G90 ; use absolute positioning\n';

    if (homeBeforePlot) {
      gcode += '\n; === SAFE HOMING SEQUENCE ===\n';
      if (preserveZZero) {
        gcode += `G0 Z${jobSettings.penUpZ.toFixed(2)} F${jobSettings.travelSpeed} ; lift pen before XY homing\n`;
        gcode += 'G28 X Y ; home X and Y only, preserve calibrated Z\n';
      } else {
        gcode += 'G91 ; relative positioning\n';
        gcode += 'G0 Z10.00 F3000 ; lift pen before homing\n';
        gcode += 'G90 ; absolute positioning\n';
        gcode += 'G28 X Y ; home X and Y\n';
        gcode += 'G28 Z ; home Z\n';
        gcode += `G0 Z${jobSettings.safeZ.toFixed(2)} F${jobSettings.travelSpeed} ; move to safe Z after homing\n`;
      }
    }

    gcode += '\n; ===== BEGIN DRAWING =====\n';
    gcode += 'G4 P1000 ; settle before plotting\n';
    gcode += `G0 Z${jobSettings.safeZ.toFixed(2)} F${jobSettings.travelSpeed} ; lift to safe Z\n`;
    gcode += 'M400 ; wait after safe lift\n';
    if (mode === 'text') {
      textItems.forEach((item, index) => {
        gcode += `; Text ${index + 1}: ${normalizeTextForGlyphs(item.text)} (${FONT_OPTIONS[item.fontKey]?.label || item.fontKey})\n`;
      });
    }
    paths.forEach((path, pathIndex) => {
      const nozzlePath = path.map((point) => penToNozzlePoint(point, jobSettings));
      gcode += `\n; Optimized path ${pathIndex + 1}\n`;
      gcode += `G0 Z${jobSettings.penUpZ.toFixed(2)} F${jobSettings.travelSpeed}\n`;
      gcode += `G0 X${nozzlePath[0].x.toFixed(2)} Y${nozzlePath[0].y.toFixed(2)} F${jobSettings.travelSpeed}\n`;
      gcode += `G1 Z${jobSettings.penDownZ.toFixed(2)} F${jobSettings.feedrate}\n`;
      nozzlePath.slice(1).forEach((point) => {
        gcode += `G1 X${point.x.toFixed(2)} Y${point.y.toFixed(2)} F${jobSettings.feedrate}\n`;
      });
      gcode += `G0 Z${jobSettings.penUpZ.toFixed(2)} F${jobSettings.travelSpeed}\n`;
      if (mode === 'text') gcode += 'G4 P50 ; text stroke separator\n';
    });
    gcode += `\n; ===== DRAWING COMPLETE =====\n`;
    gcode += `G0 Z${jobSettings.safeZ.toFixed(2)} F${jobSettings.travelSpeed} ; lift pen\n`;
    gcode += 'M400\n';
    gcode += `G0 X${jobSettings.parkX.toFixed(2)} Y${jobSettings.parkY.toFixed(2)} F${jobSettings.travelSpeed} ; park\n`;
    gcode += 'M400 ; end of plot\n';
    return useLineNumbers ? addLineNumbers(gcode) : gcode;
  };

  const callPrinterApi = async (path, body = null) => {
    try {
      const response = await fetch(`${PRINTER_API}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Printer backend did not return JSON. Make sure npm.cmd run server is running at ${PRINTER_API}.`);
      }
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || data.validation?.errors?.join(' ') || 'Printer API request failed.');
      setPrinterMessage(data.message || (data.filename ? `Started ${data.filename} by file mode.` : (data.sentLineCount ? `Sent ${data.sentLineCount} paced G-code lines.` : 'Printer command accepted.')));
      return data;
    } catch (error) {
      setPrinterMessage(error.message);
      return null;
    }
  };

  const updatePrinterConfig = (patch) => {
    setPrinterConfig((current) => {
      const next = { ...current, ...patch };
      localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const forgetPrinterConfig = () => {
    localStorage.removeItem(PRINTER_STORAGE_KEY);
    setPrinterConfig({ host: '', serial: '', accessCode: '' });
    setPrinterMessage('Saved printer details cleared.');
  };

  const refreshPrinterStatus = async () => {
    const data = await callPrinterApi('/api/printer/status');
    if (data) {
      setPrinterStatus(data);
      setPrinterMessage(data.connected ? 'Printer connected.' : (data.lastError || 'Printer not connected.'));
      if (data.connected) setPrinterDetailsOpen(false);
    }
  };

  const connectPrinter = async () => {
    const data = await callPrinterApi('/api/printer/connect', printerConfig);
    if (data) setTimeout(refreshPrinterStatus, 900);
  };

  const discoverPrinters = async ({ quiet = false } = {}) => {
    if (!printerConfig.accessCode && !quiet) {
      setPrinterMessage('Enter your LAN access code first, then discover printers.');
      return null;
    }
    setDiscoveryBusy(true);
    if (!quiet) setPrinterMessage('Searching for Bambu printers on your network...');
    const data = await callPrinterApi('/api/printer/discover', {
      serial: printerConfig.serial,
      accessCode: printerConfig.accessCode,
      autoConnect: true,
    });
    setDiscoveryBusy(false);
    const discovered = data?.connectedPrinter || data?.selectedPrinter;
    if (discovered) {
      updatePrinterConfig({
        host: discovered.host,
        serial: discovered.serial || printerConfig.serial,
      });
    }
    if (data?.connectedPrinter) {
      setTimeout(refreshPrinterStatus, 900);
    }
    return data;
  };

  const disconnectPrinter = async () => {
    const data = await callPrinterApi('/api/printer/disconnect', {});
    if (data) {
      setPrinterStatus({ connected: false, lastReport: null });
      setPrinterDetailsOpen(true);
    }
  };

  const jogPrinter = (move) => {
    callPrinterApi('/api/printer/jog', { ...move, feedrate: settings.travelSpeed, confirmed: zConfirmed });
  };

  const toggleToolheadFan = async () => {
    const nextFanState = !toolheadFanOn;
    const data = await callPrinterApi('/api/printer/toolhead-fan', { on: nextFanState });
    if (data) setToolheadFanOn(nextFanState);
  };

  const sendPlotToPrinter = () => {
    const job = preparedJobIsFresh ? preparedJob : slicePlot();
    if (!job) return;
    callPrinterApi('/api/printer/send-gcode', {
      gcode: job.gcode,
      confirmed: sendConfirmed,
      allowNegativeZ: zConfirmed,
      allowHome: homeBeforeDirectSend,
      method: 'stream',
      lineDelayMs,
    });
  };

  const slicePlot = () => {
    const paths = exportPaths.map((path) => path.map((point) => ({ x: point.x, y: point.y })));
    const jobSettings = { ...settings };
    const gcode = buildPlotGCode({
      homeBeforePlot: homeBeforeDirectSend,
      paths,
      jobSettings,
      useLineNumbers: false,
      useBambuSafetyHeader: bambuSafetyHeader,
    });
    const validation = validateGCodeLocally(gcode, {
      allowNegativeZ: zConfirmed,
      allowHome: homeBeforeDirectSend,
    });
    const textSummary = mode === 'text' ? `Text: ${textItems.map((item) => normalizeTextForGlyphs(item.text)).join(' | ')}. ` : '';
    const nextJob = {
      gcode,
      validation,
      pathCount: paths.length,
      createdAt: new Date().toLocaleTimeString(),
      signature: sliceSignature,
      summary: `${textSummary}${validation.lineCount} executable lines, ${validation.byteCount} bytes, ${paths.length} paths. ${validation.ok ? 'Ready to send.' : validation.errors[0]}`,
    };
    setPreparedJob(nextJob);
    setPreflightMessage(nextJob.summary);
    return validation.ok ? nextJob : null;
  };

  const preflightPlot = () => {
    slicePlot();
  };

  const refreshMqttLog = useCallback(async ({ reset = false } = {}) => {
    const since = reset ? 0 : mqttLastId.current;
    const data = await callPrinterApi(`/api/printer/mqtt-log?since=${since}`);
    mqttLastId.current = data.lastId || mqttLastId.current;
    if (reset) setMqttLogEntries(data.entries || []);
    else if (data.entries?.length) setMqttLogEntries((current) => [...current, ...data.entries].slice(-250));
  }, []);

  const clearMqttLog = async () => {
    const data = await callPrinterApi('/api/printer/mqtt-log/clear', {});
    mqttLastId.current = data.lastId || 0;
    setMqttLogEntries([]);
  };

  const checkForUpdates = async () => {
    setUpdateBusy(true);
    setUpdateStatus((current) => ({ ...current, message: 'Checking GitHub...' }));
    try {
      const response = await fetch(`${PRINTER_API}/api/app/check-update`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Update check failed.');
      setUpdateStatus({
        latestVersion: data.latestVersion,
        updateAvailable: data.updateAvailable,
        message: data.updateAvailable
          ? `Update available: v${data.latestVersion}`
          : `You are up to date at v${data.currentVersion}.`,
      });
    } catch (error) {
      setUpdateStatus({ latestVersion: '', updateAvailable: false, message: error.message });
    } finally {
      setUpdateBusy(false);
    }
  };

  const updateApp = async () => {
    setUpdateBusy(true);
    setUpdateStatus((current) => ({ ...current, message: 'Installing update...' }));
    try {
      const response = await fetch(`${PRINTER_API}/api/app/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Update failed.');
      setUpdateStatus({
        latestVersion: data.latestVersion,
        updateAvailable: false,
        message: data.message || 'Updated. Restarting Plotter Studio...',
      });
    } catch (error) {
      setUpdateStatus((current) => ({ ...current, message: error.message }));
      setUpdateBusy(false);
    }
  };

  useEffect(() => {
    if (!mqttViewerOpen) return undefined;
    refreshMqttLog({ reset: true });
    const interval = window.setInterval(() => refreshMqttLog(), 1000);
    return () => window.clearInterval(interval);
  }, [mqttViewerOpen, refreshMqttLog]);

  useEffect(() => {
    if (autoDiscoveryTried.current || printerStatus.connected) return;
    if (!printerConfig.serial || !printerConfig.accessCode) return;
    autoDiscoveryTried.current = true;
    let cancelled = false;
    const run = async () => {
      setDiscoveryBusy(true);
      try {
        const response = await fetch(`${PRINTER_API}/api/printer/discover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serial: printerConfig.serial, accessCode: printerConfig.accessCode, autoConnect: true }),
        });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok || !data.ok) throw new Error(data.error || 'Printer discovery failed.');
        setPrinterMessage(data.message || 'Printer discovery finished.');
        const discovered = data.connectedPrinter || data.selectedPrinter;
        if (discovered) {
          updatePrinterConfig({
            host: discovered.host,
            serial: discovered.serial || printerConfig.serial,
          });
        }
        if (data.connectedPrinter) {
          setTimeout(async () => {
            const statusResponse = await fetch(`${PRINTER_API}/api/printer/status`);
            const statusData = await statusResponse.json();
            if (statusData.ok) {
              setPrinterStatus(statusData);
              setPrinterMessage(statusData.connected ? 'Printer connected.' : (statusData.lastError || 'Printer not connected.'));
              if (statusData.connected) setPrinterDetailsOpen(false);
            }
          }, 900);
        }
      } catch (error) {
        if (!cancelled) setPrinterMessage(error.message);
      } finally {
        if (!cancelled) setDiscoveryBusy(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [printerConfig.accessCode, printerConfig.serial, printerStatus.connected]);

  useEffect(() => {
    setSettings((current) => {
      const clamped = clampPaperToReachableArea(current);
      if (
        clamped.originX === current.originX
        && clamped.originY === current.originY
        && clamped.paperWidth === current.paperWidth
        && clamped.paperHeight === current.paperHeight
      ) return current;
      return clamped;
    });
  }, [settings.bedHeight, settings.bedWidth, settings.originX, settings.originY, settings.paperHeight, settings.paperWidth, settings.penTipOffsetX, settings.penTipOffsetY]);

  useEffect(() => {
    if (!mqttViewerOpen || !mqttLogRef.current) return;
    mqttLogRef.current.scrollTop = mqttLogRef.current.scrollHeight;
  }, [mqttLogEntries, mqttViewerOpen]);

  useEffect(() => {
    if (!playbackPlaying) return undefined;
    const interval = window.setInterval(() => {
      setPlaybackProgress((current) => {
        const next = current + 0.01;
        if (next >= 1) {
          setPlaybackPlaying(false);
          return 1;
        }
        return next;
      });
    }, 45);
    return () => window.clearInterval(interval);
  }, [playbackPlaying]);

  useEffect(() => {
    if (!printerStatus.connected) setTapToMoveActive(false);
  }, [printerStatus.connected]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-cluster">
          <div className="brand-menu">
            <button className="brand-button" onClick={() => setBrandMenuOpen((open) => !open)}>
              <span className="brand-mark">3D</span><span className="brand-name">Plotter studio</span>
            </button>
            {brandMenuOpen && (
              <div className="brand-popover">
                <div>
                  <h2>Plotter studio</h2>
                  <p>Version {packageInfo.version}</p>
                </div>
                <button onClick={checkForUpdates} disabled={updateBusy}>{updateBusy ? 'Checking...' : 'Check for updates'}</button>
                <button className="primary-action" onClick={updateApp} disabled={updateBusy || !updateStatus.updateAvailable}>Update automatically</button>
                {updateStatus.message && <p className="status-line">{updateStatus.message}</p>}
              </div>
            )}
          </div>
          <div className="preset-menu">
            <button onClick={() => setPresetMenuOpen((open) => !open)}>{PRESETS[settings.preset].label}</button>
            {presetMenuOpen && (
              <div className="preset-popover">
                <label><span>Printer</span><select value={settings.preset} onChange={(event) => handlePresetChange(event.target.value)}>{Object.entries(PRESETS).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}</select></label>
                <div className="settings-grid compact">
                  <NumberInput label="Bed W" value={settings.bedWidth} onChange={(value) => handleSettingChange('bedWidth', value)} />
                  <NumberInput label="Bed H" value={settings.bedHeight} onChange={(value) => handleSettingChange('bedHeight', value)} />
                  <NumberInput label="Paper W" value={settings.paperWidth} onChange={(value) => handleSettingChange('paperWidth', value)} />
                  <NumberInput label="Paper H" value={settings.paperHeight} onChange={(value) => handleSettingChange('paperHeight', value)} />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="topbar-actions">
          <label className="topbar-toggle"><input type="checkbox" checked={advancedOpen} onChange={(event) => { setAdvancedOpen(event.target.checked); if (!event.target.checked) setMqttViewerOpen(false); }} /><span>Advanced</span></label>
          {advancedOpen && <button onClick={() => setMqttViewerOpen(true)}>MQTT</button>}
          <button onClick={addWorkingLayer} disabled={!workingPaths.length}>Add Layer</button>
          <div className="export-menu">
            <button className="primary-action" onClick={() => setExportMenuOpen((open) => !open)}>Export</button>
            {exportMenuOpen && (
              <div className="export-popover">
                <button onClick={() => { exportSvg(); setExportMenuOpen(false); }} disabled={!exportPaths.length}>SVG</button>
                <button onClick={() => { exportGCode(); setExportMenuOpen(false); }} disabled={!exportPaths.length}>G-code</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {mqttViewerOpen && (
        <div className="mqtt-overlay" role="dialog" aria-modal="true" aria-label="MQTT command log">
          <section className="mqtt-panel">
            <div className="mqtt-header">
              <div>
                <h2>MQTT Commands</h2>
                <p>{mqttLogEntries.length} recent entries</p>
              </div>
              <div className="mqtt-actions">
                <button onClick={() => refreshMqttLog({ reset: true })}>Refresh</button>
                <button onClick={clearMqttLog}>Clear</button>
                <button onClick={() => setMqttViewerOpen(false)}>Close</button>
              </div>
            </div>
            <div className="mqtt-log" ref={mqttLogRef}>
              {mqttLogEntries.length === 0 && <p className="muted">No MQTT traffic captured yet.</p>}
              {mqttLogEntries.map((entry) => {
                const summary = getMqttEntrySummary(entry);
                return (
                  <article key={entry.id} className={`mqtt-entry ${entry.direction}`}>
                    <div className="mqtt-entry-row">
                      <span className="mqtt-badge">{entry.direction === 'out' ? 'OUT' : 'IN'}</span>
                      <span className="mqtt-time">{new Date(entry.time).toLocaleTimeString()}</span>
                      <div className="mqtt-summary">
                        <strong>{summary.title}</strong>
                        <span>{summary.detail}</span>
                      </div>
                      {summary.sequence && <span className="mqtt-sequence">#{summary.sequence}</span>}
                    </div>
                    <details>
                      <summary>Raw JSON</summary>
                      <div className="mqtt-topic">{entry.topic}</div>
                      <pre>{prettyMqttPayload(entry.payload)}</pre>
                    </details>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {playbackOpen && (
        <div className="mqtt-overlay" role="dialog" aria-modal="true" aria-label="Plot playback preview">
          <section className="playback-panel">
            <div className="mqtt-header">
              <div>
                <h2>Plot Playback</h2>
                <p>{Math.round(playbackProgress * 100)}% · {playbackSourcePaths.length} paths · {Math.round(estimateDistance(playbackSourcePaths))} mm</p>
              </div>
              <div className="mqtt-actions">
                <button onClick={() => setPlaybackPlaying((playing) => !playing)}>{playbackPlaying ? 'Pause' : 'Play'}</button>
                <button onClick={() => { setPlaybackPlaying(false); setPlaybackProgress(0); }}>Restart</button>
                <button onClick={() => { setPlaybackPlaying(false); setPlaybackOpen(false); }}>Close</button>
              </div>
            </div>
            <div className="playback-body">
              <svg viewBox={`0 0 ${settings.bedWidth} ${settings.bedHeight}`} className="playback-svg">
                <rect width={settings.bedWidth} height={settings.bedHeight} fill="#101416" />
                <rect x={settings.originX} y={settings.originY} width={settings.paperWidth} height={settings.paperHeight} fill="#fbfbf7" stroke="#14b8a6" strokeWidth="0.8" strokeDasharray="3 2" />
                {playbackSourcePaths.map((path, index) => <path key={`ghost-${index}`} d={toPathData(path)} fill="none" stroke="#475569" strokeWidth="0.45" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />)}
                {playbackPreviewPaths.map((path, index) => <path key={`play-${index}`} d={toPathData(path)} fill="none" stroke="#67e8f9" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />)}
              </svg>
              <input type="range" min="0" max="100" value={Math.round(playbackProgress * 100)} onChange={(event) => { setPlaybackPlaying(false); setPlaybackProgress(Number(event.target.value) / 100); }} />
            </div>
          </section>
        </div>
      )}

      <section className="workspace">
        <aside className="panel controls-panel">
          <div className="mode-tabs">
            {['text', 'photos', 'qr', 'patterns', 'draw', 'calibrate'].map((item) => (
              <button key={item} className={mode === item ? 'active' : ''} onClick={() => setMode(item)}>{item}</button>
            ))}
          </div>

          {mode === 'text' && (
            <div className="control-group">
              <h2>Hershey Text</h2>
              <div className="text-list">
                {textItems.map((item, index) => (
                  <button key={item.id} className={item.id === selectedText?.id ? 'active' : ''} onClick={() => setSelectedTextId(item.id)}>
                    {item.text || `Text ${index + 1}`}
                  </button>
                ))}
              </div>
              <div className="button-row">
                <button onClick={addTextItem}>Add Text</button>
                <button onClick={removeSelectedText} disabled={textItems.length <= 1}>Remove</button>
              </div>
              <label><span>Text</span><input value={selectedText?.text || ''} onChange={(event) => updateTextItem(selectedText.id, { text: event.target.value })} /></label>
              <label>
                <span>Font</span>
                <select value={selectedText?.fontKey || DEFAULT_HERSHEY_FONT} onChange={(event) => updateTextItem(selectedText.id, { fontKey: event.target.value })}>
                  {Object.entries(FONT_OPTIONS).map(([key, font]) => <option key={key} value={key}>{font.label}</option>)}
                </select>
              </label>
              <div className="settings-grid compact">
                <NumberInput label="X" value={selectedText?.object.x || 0} onChange={(value) => updateTextObject(selectedText.id, { ...selectedText.object, x: value })} />
                <NumberInput label="Y" value={selectedText?.object.y || 0} onChange={(value) => updateTextObject(selectedText.id, { ...selectedText.object, y: value })} />
                <NumberInput label="W" value={selectedText?.object.w || 0} onChange={(value) => updateTextObject(selectedText.id, { ...selectedText.object, w: value })} />
                <NumberInput label="H" value={selectedText?.object.h || 0} onChange={(value) => updateTextObject(selectedText.id, { ...selectedText.object, h: value })} />
                <NumberInput label="Angle" value={Math.round(selectedText?.object.angle || 0)} onChange={(value) => updateTextObject(selectedText.id, { ...selectedText.object, angle: value })} />
              </div>
              {unsupportedChars.length > 0 && (
                <p className="warning compact-warning">Unsupported text characters skipped: {unsupportedChars.join(' ')}</p>
              )}
              {compressedTexts.length > 0 && (
                <p className="warning compact-warning">Some text is too compressed and may overlap. Increase width or reduce characters.</p>
              )}
              <p className="muted">Each text block has independent content, font, position, size, and rotation. Select a block here or on the preview.</p>
            </div>
          )}

          {mode === 'photos' && (
            <div className="control-group">
              <h2>Photos</h2>
              <div className="sub-tabs">
                <button className={photoMode === 'image' ? 'active' : ''} onClick={() => setPhotoMode('image')}>Image</button>
                <button className={photoMode === 'svg' ? 'active' : ''} onClick={() => setPhotoMode('svg')}>SVG</button>
              </div>
              {photoMode === 'image' && (
                <>
                  <h3 className="subheading">Image to SVG</h3>
                  <label className="file-drop"><span>{imageName || 'Upload raster image'}</span><input type="file" accept="image/*" onChange={handleAssetFile} /></label>
                  <label><span>Mode</span><select value={traceMode} onChange={(event) => { const value = event.target.value; setTraceMode(value); if (previewUrl) traceImage(previewUrl, traceThreshold, traceSpacing, value, traceDetail, traceInvert); }}><option value="connected-outline">Connected outline</option><option value="fine-outline">Fine outline</option><option value="outline">Threshold outline</option><option value="sketch">Sketch</option><option value="hatching">Hatching</option><option value="stipple">Stipple</option></select></label>
                  <label><span>Threshold {traceThreshold}</span><input type="range" min="20" max="245" value={traceThreshold} onChange={(event) => { const value = Number(event.target.value); setTraceThreshold(value); if (previewUrl) traceImage(previewUrl, value, traceSpacing, traceMode, traceDetail, traceInvert); }} /></label>
                  <label><span>Spacing {traceSpacing.toFixed(1)} mm</span><input type="range" min="0.2" max="14" step="0.1" value={traceSpacing} onChange={(event) => { const value = Number(event.target.value); setTraceSpacing(value); if (previewUrl) traceImage(previewUrl, traceThreshold, value, traceMode, traceDetail, traceInvert); }} /></label>
                  <label><span>Detail {traceDetail}px</span><input type="range" min="120" max="900" step="20" value={traceDetail} onChange={(event) => { const value = Number(event.target.value); setTraceDetail(value); if (previewUrl) traceImage(previewUrl, traceThreshold, traceSpacing, traceMode, value, traceInvert); }} /></label>
                  <label className="toggle-row"><input type="checkbox" checked={traceInvert} onChange={(event) => { const value = event.target.checked; setTraceInvert(value); if (previewUrl) traceImage(previewUrl, traceThreshold, traceSpacing, traceMode, traceDetail, value); }} /><span>Invert image</span></label>
                  <div className="image-vector-preview">
                    <svg viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet">
                      {previewUrl && <image href={previewUrl} x="0" y="0" width="1" height="1" opacity="0.18" preserveAspectRatio="xMidYMid meet" />}
                      {imageLocalPaths.slice(0, 6000).map((path, index) => <path key={index} d={toPathData(path)} fill="none" stroke="#67e8f9" strokeWidth="0.003" strokeLinecap="round" strokeLinejoin="round" />)}
                    </svg>
                  </div>
                  <div className="button-row">
                    <button onClick={() => previewUrl && traceImage(previewUrl, traceThreshold, traceSpacing, traceMode, traceDetail, traceInvert)} disabled={!previewUrl}>Refresh Trace</button>
                    <button onClick={exportTracedImageSvg} disabled={!imageLocalPaths.length}>Download SVG</button>
                  </div>
                  <p className="muted">{imageLocalPaths.length ? `${imageLocalPaths.length} vector strokes generated. Lower spacing and raise detail for finer output.` : 'Upload an image and adjust the sliders until the vector preview looks right.'}</p>
                </>
              )}
              {photoMode === 'svg' && (
                <>
                  <label className="file-drop"><span>{svgName || 'Import SVG'}</span><input type="file" accept=".svg,image/svg+xml" onChange={handleAssetFile} /></label>
                  <label className="toggle-row"><input type="checkbox" checked={fillHoles} onChange={(event) => { setFillHoles(event.target.checked); if (!event.target.checked) setSvgFillPaths([]); }} /><span>Add hatch fills on import</span></label>
                  <p className="muted">Parses paths, lines, polygons, rects, circles, and ellipses. Hatch fills add scanlines inside filled shapes.</p>
                </>
              )}
            </div>
          )}

          {mode === 'qr' && (
            <div className="control-group">
              <h2>QR Code</h2>
              <label><span>Content</span><input value={qrText} onChange={(event) => setQrText(event.target.value)} /></label>
              <label><span>Style</span><select value={qrStyle} onChange={(event) => setQrStyle(event.target.value)}><option value="square">Square</option><option value="rounded">Rounded outline</option><option value="dots">Dots</option></select></label>
              {qrStyle !== 'dots' && (
                <button className={qrFilled ? 'active-toggle' : ''} onClick={() => setQrFilled((filled) => !filled)}>
                  {qrFilled ? 'Filled modules on' : 'Fill modules'}
                </button>
              )}
              <button onClick={generateQr}>Generate QR Paths</button>
            </div>
          )}

          {mode === 'patterns' && (
            <div className="control-group">
              <h2>Generative Patterns</h2>
              <label><span>Pattern</span><select value={patternType} onChange={(event) => setPatternType(event.target.value)}><option value="hatching">Hatching</option><option value="crosshatch">Crosshatch</option><option value="diagonal">Diagonal hatch</option><option value="spiral">Spiral</option><option value="flow">Flow lines</option><option value="contour">Contour lines</option></select></label>
              <label><span>Spacing {traceSpacing} mm</span><input type="range" min="2" max="14" value={traceSpacing} onChange={(event) => setTraceSpacing(Number(event.target.value))} /></label>
            </div>
          )}

          {mode === 'draw' && <div className="control-group"><h2>Freehand</h2><p className="muted">Draw directly on the preview. Strokes are simplified as you draw to keep the app responsive.</p><button onClick={clearDrawing}>Clear drawing</button></div>}
          {mode === 'calibrate' && <div className="control-group"><h2>Calibration + Offset</h2><p className="muted">Exports a 50 mm square, diagonals, center lines, and an offset crosshair.</p></div>}

          <div className="control-group objects-control">
            <h2>Objects</h2>
            <div className="object-list">
              {objectRows.map((row) => (
                <div className="object-row" key={row.key}>
                  <label className="toggle-row">
                    <input type="checkbox" checked={objectVisibility[row.key]} onChange={(event) => setObjectVisibility((current) => ({ ...current, [row.key]: event.target.checked }))} />
                    <span>{row.label}</span>
                  </label>
                  <span>{row.count}</span>
                  <button onClick={() => clearObjectGroup(row.key)} disabled={!row.count}>Clear</button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="preview-panel">
          <div className="preview-header">
            <div><h2>Layer Preview</h2><p>{settings.bedWidth} x {settings.bedHeight} mm board, {settings.paperWidth} x {settings.paperHeight} mm paper</p></div>
            <div className="stats">
              <button className={`preview-clear-button${tapToMoveActive && printerStatus.connected ? ' tap-move-active' : ''}`} onClick={() => setTapToMoveActive((prev) => !prev)} disabled={!printerStatus.connected} title={printerStatus.connected ? 'Click to move toolhead by tapping the bed' : 'Connect a printer to enable'}>Tap to Move</button>
              <button className="danger-action preview-clear-button" onClick={clearEverything}>Clear Everything</button>
              <span>{stats.paths} paths</span>
              <span>{stats.points} points</span>
              <span>{Math.round(stats.distance)} mm</span>
            </div>
          </div>
          <svg id="build-plate-svg" viewBox={`0 0 ${settings.bedWidth} ${settings.bedHeight}`} className={`build-plate ${tapToMoveActive && printerStatus.connected ? 'build-plate-tap-active' : ''}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
            <defs>
              <linearGradient id="plate-sheen" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#22272a" />
                <stop offset="48%" stopColor="#171b1d" />
                <stop offset="100%" stopColor="#252a2d" />
              </linearGradient>
              <pattern id="plate-texture" width="7" height="7" patternUnits="userSpaceOnUse">
                <rect width="7" height="7" fill="transparent" />
                <path d="M0 7 L7 0" stroke="#2f3639" strokeWidth="0.35" opacity="0.55" />
                <circle cx="1.5" cy="1.5" r="0.35" fill="#3c4548" opacity="0.5" />
              </pattern>
              <pattern id="plate-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#5b676b" strokeWidth="0.22" opacity="0.72" />
              </pattern>
              <pattern id="plate-grid-major" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#7d8b8f" strokeWidth="0.45" opacity="0.72" />
              </pattern>
            </defs>
            <rect width={settings.bedWidth} height={settings.bedHeight} rx="4" fill="url(#plate-sheen)" stroke="#3f494d" strokeWidth="1.2" />
            <rect width={settings.bedWidth} height={settings.bedHeight} rx="4" fill="url(#plate-texture)" opacity="0.95" />
            <rect width={settings.bedWidth} height={settings.bedHeight} rx="4" fill="url(#plate-grid)" />
            <rect width={settings.bedWidth} height={settings.bedHeight} rx="4" fill="url(#plate-grid-major)" />
            {unreachableZones.map((zone, index) => (
              <g key={`unreachable-${index}`} className="unreachable-zone">
                <rect x={zone.x} y={zone.y} width={zone.width} height={zone.height} />
                {zone.width > 14 && zone.height > 14 && (
                  <text x={zone.x + zone.width / 2} y={zone.y + zone.height / 2} textAnchor="middle" dominantBaseline="middle">
                    Pen unreachable
                  </text>
                )}
              </g>
            ))}
            <line x1={settings.bedWidth / 2} y1="8" x2={settings.bedWidth / 2} y2={settings.bedHeight - 8} stroke="#14b8a6" strokeWidth="0.55" opacity="0.85" />
            <line x1="8" y1={settings.bedHeight / 2} x2={settings.bedWidth - 8} y2={settings.bedHeight / 2} stroke="#14b8a6" strokeWidth="0.55" opacity="0.85" />
            <circle cx={settings.bedWidth / 2} cy={settings.bedHeight / 2} r="5" fill="none" stroke="#14b8a6" strokeWidth="0.55" opacity="0.9" />
            {[0, 50, 100, 150, 200, 250].filter((tick) => tick <= settings.bedWidth).map((tick) => (
              <text key={`x-${tick}`} x={Math.max(8, Math.min(settings.bedWidth - 12, tick))} y="13" fill="#c9d2d5" fontSize="5" textAnchor="middle">{tick}</text>
            ))}
            {[50, 100, 150, 200, 250].filter((tick) => tick <= settings.bedHeight).map((tick) => (
              <text key={`y-${tick}`} x="9" y={tick + 1.5} fill="#c9d2d5" fontSize="5" textAnchor="middle">{tick}</text>
            ))}
            <rect data-paper="true" x={settings.originX} y={settings.originY} width={settings.paperWidth} height={settings.paperHeight} fill="#fbfbf7" fillOpacity="0.92" stroke="#14b8a6" strokeWidth="0.9" strokeDasharray="3 2" className={presetMenuOpen ? 'paper-rect paper-rect-move' : 'paper-rect'} />
            {presetMenuOpen && (
              <circle data-handle="paper-resize" cx={settings.originX + settings.paperWidth} cy={settings.originY + settings.paperHeight} r="4.5" fill="#14b8a6" className="paper-resize-handle" />
            )}
            {previewUrl && mode === 'photos' && photoMode === 'image' && <image href={previewUrl} x={object.x} y={object.y} width={object.w} height={object.h} opacity="0.16" preserveAspectRatio="xMidYMid meet" />}
            {enabledLayers.length > 0
              ? enabledLayers.map((layer) => layer.paths.map((path, index) => <path key={`${layer.id}-${index}`} d={toPathData(applySettings([path], settings, { mirrorOutput: false })[0])} fill="none" stroke={layer.color} strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round" />))
              : projectPaths.map((path, index) => <path key={index} d={toPathData(applySettings([path], settings, { mirrorOutput: false })[0])} fill="none" stroke="#0f766e" strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round" />)}
            {mode === 'text' && textItems.map((item) => (
              <g key={item.id} transform={`rotate(${item.object.angle} ${item.object.x + item.object.w / 2} ${item.object.y + item.object.h / 2})`}>
                <rect
                  data-text-id={item.id}
                  x={item.object.x}
                  y={item.object.y}
                  width={item.object.w}
                  height={item.object.h}
                  fill="transparent"
                  stroke={item.id === selectedText?.id ? '#b45309' : '#0f766e'}
                  strokeWidth={item.id === selectedText?.id ? 1.4 : 0.8}
                  strokeDasharray="4 2"
                />
                {item.id === selectedText?.id && (
                  <>
                    <circle data-text-id={item.id} data-handle="resize" cx={item.object.x + item.object.w} cy={item.object.y + item.object.h} r="4" fill="#0f766e" />
                    <circle data-text-id={item.id} data-handle="rotate" cx={item.object.x + item.object.w / 2} cy={item.object.y - 10} r="4" fill="#b45309" />
                  </>
                )}
              </g>
            ))}
            {(['photos', 'qr'].includes(mode)) && <g transform={`rotate(${object.angle} ${object.x + object.w / 2} ${object.y + object.h / 2})`}><rect x={object.x} y={object.y} width={object.w} height={object.h} fill="none" stroke="#0f766e" strokeWidth="1" strokeDasharray="4 2" /><circle data-handle="resize" cx={object.x + object.w} cy={object.y + object.h} r="4" fill="#0f766e" /><circle data-handle="rotate" cx={object.x + object.w / 2} cy={object.y - 10} r="4" fill="#b45309" /></g>}
            {tapToMoveMarker && (
              <g className="tap-move-marker">
                <circle cx={tapToMoveMarker.x} cy={tapToMoveMarker.y} r="4" fill="none" stroke="#f59e0b" strokeWidth="0.8" />
                <line x1={tapToMoveMarker.x - 8} y1={tapToMoveMarker.y} x2={tapToMoveMarker.x + 8} y2={tapToMoveMarker.y} stroke="#f59e0b" strokeWidth="0.7" />
                <line x1={tapToMoveMarker.x} y1={tapToMoveMarker.y - 8} x2={tapToMoveMarker.x} y2={tapToMoveMarker.y + 8} stroke="#f59e0b" strokeWidth="0.7" />
              </g>
            )}
          </svg>
        </section>

        <aside className="panel settings-panel">
          <div className="control-group">
            <h2>Printer Control</h2>
            <button className="collapse-button" onClick={() => setPrinterDetailsOpen((open) => !open)}>
              {printerDetailsOpen ? 'Hide Printer Details' : 'Show Printer Details'}
            </button>
            <p className="status-line">{printerStatus.connected ? 'Connected' : 'Not connected'} · {printerMessage}</p>
            {printerDetailsOpen && (
              <div className="collapsible-section">
                <label><span>Printer IP</span><input value={printerConfig.host} onChange={(event) => updatePrinterConfig({ host: event.target.value })} placeholder="192.168.1.42" /></label>
                <label><span>Serial / Device ID</span><input value={printerConfig.serial} onChange={(event) => updatePrinterConfig({ serial: event.target.value })} placeholder="00M..." /></label>
                <label><span>LAN Access Code</span><input type="password" value={printerConfig.accessCode} onChange={(event) => updatePrinterConfig({ accessCode: event.target.value })} placeholder="8-character code" /></label>
                <button onClick={() => discoverPrinters()} disabled={discoveryBusy}>{discoveryBusy ? 'Discovering...' : 'Discover Printers'}</button>
                <button onClick={forgetPrinterConfig}>Forget Saved Printer</button>
              </div>
            )}
            <p className="status-line printer-status-line">{printerStatus.connected ? 'Connected' : 'Not connected'} · {printerMessage}</p>
            <div className="button-row">
              <button onClick={printerStatus.connected ? disconnectPrinter : connectPrinter}>
                {printerStatus.connected ? 'Disconnect' : 'Connect'}
              </button>
              <button onClick={refreshPrinterStatus}>Refresh Status</button>
            </div>
            <div className="jog-section">
              <div className="xy-pad" aria-label="XY jog pad">
                <button className="pad-up" onClick={() => jogPrinter({ y: 10 })} disabled={!printerStatus.connected}>Y+</button>
                <button className="pad-left" onClick={() => jogPrinter({ x: -10 })} disabled={!printerStatus.connected}>X-</button>
                <button className="pad-center home-icon-button" onClick={() => callPrinterApi('/api/printer/home', {})} disabled={!printerStatus.connected} aria-label="Home printer">⌂</button>
                <button className="pad-right" onClick={() => jogPrinter({ x: 10 })} disabled={!printerStatus.connected}>X+</button>
                <button className="pad-down" onClick={() => jogPrinter({ y: -10 })} disabled={!printerStatus.connected}>Y-</button>
              </div>
              <div className="z-pad" aria-label="Z jog controls">
                <button onClick={() => jogPrinter({ z: 1 })} disabled={!printerStatus.connected}>Z up +1</button>
                <button onClick={() => jogPrinter({ z: 0.1 })} disabled={!printerStatus.connected}>Z up +0.1</button>
                <button onClick={() => jogPrinter({ z: -0.1 })} disabled={!printerStatus.connected || !zConfirmed}>Z down -0.1</button>
                <button onClick={() => jogPrinter({ z: -1 })} disabled={!printerStatus.connected || !zConfirmed}>Z down -1</button>
              </div>
            </div>
            <label className="toggle-row"><input type="checkbox" checked={zConfirmed} onChange={(event) => setZConfirmed(event.target.checked)} /><span>I am watching the pen and accept Z movement risk</span></label>
            <button onClick={() => callPrinterApi('/api/printer/set-z-zero', { confirmed: zConfirmed })} disabled={!printerStatus.connected || !zConfirmed}>Set Current Z as 0</button>
            {advancedOpen && (
              <>
                <button onClick={toggleToolheadFan} disabled={!printerStatus.connected}>{toolheadFanOn ? 'Turn Toolhead Fan Off' : 'Turn Toolhead Fan On'}</button>
                <button onClick={() => callPrinterApi('/api/printer/release-motors', {})} disabled={!printerStatus.connected}>Release Motors</button>
              </>
            )}
            <label className="toggle-row"><input type="checkbox" checked={sendConfirmed} onChange={(event) => setSendConfirmed(event.target.checked)} /><span>I verified pen mount, paper, path bounds, and Z height</span></label>
            {advancedOpen && <label className="toggle-row"><input type="checkbox" checked={preserveZZero} onChange={(event) => setPreserveZZero(event.target.checked)} /><span>Preserve current Z0 for pen plotting</span></label>}
            {advancedOpen && <label><span>G-code line delay {lineDelayMs} ms</span><input type="range" min="80" max="1200" step="20" value={lineDelayMs} onChange={(event) => setLineDelayMs(Number(event.target.value))} /></label>}
            <div className="button-row">
              <button onClick={preflightPlot} disabled={!exportPaths.length}>Slice Plot</button>
              <button onClick={() => { setPlaybackProgress(0); setPlaybackOpen(true); }} disabled={!exportPaths.length}>Playback</button>
            </div>
            {preflightMessage && <p className="status-line">{preparedJob?.createdAt ? `Sliced at ${preparedJob.createdAt}. ` : ''}{preflightMessage}{preparedJob && !preparedJobIsFresh ? ' Design changed, slice again before sending.' : ''}</p>}
            <button className="danger-action" onClick={sendPlotToPrinter} disabled={!printerStatus.connected || !preparedJobIsFresh || !preparedJob?.validation.ok || !sendConfirmed}>Send Sliced G-code</button>
            <div className="button-row">
              <button onClick={() => callPrinterApi('/api/printer/pause', {})} disabled={!printerStatus.connected}>Pause</button>
              <button onClick={() => callPrinterApi('/api/printer/resume', {})} disabled={!printerStatus.connected}>Resume</button>
            </div>
            <button className="danger-action" onClick={() => callPrinterApi('/api/printer/stop', {})} disabled={!printerStatus.connected}>Emergency Stop Plot</button>
            <p className="status-line">{printerStatus.connected ? 'Connected' : 'Not connected'} · {printerMessage}</p>
          </div>

          {advancedOpen && <div className="control-group">
            <h2>Motion + Offset</h2>
            <button className="collapse-button" onClick={() => setMotionOpen((open) => !open)}>
              {motionOpen ? 'Hide Motion Settings' : 'Show Motion Settings'}
            </button>
            {motionOpen && (
              <div className="collapsible-section">
                <div className="settings-grid">
                  <NumberInput label="Scale" step="0.1" value={settings.scale} onChange={(value) => handleSettingChange('scale', value)} />
                  <NumberInput label="Pen up Z" step="0.1" value={settings.penUpZ} onChange={(value) => handleSettingChange('penUpZ', value)} />
                  <NumberInput label="Pen down Z" step="0.1" value={settings.penDownZ} onChange={(value) => handleSettingChange('penDownZ', value)} />
                  <NumberInput label="Safe Z" step="0.1" value={settings.safeZ} onChange={(value) => handleSettingChange('safeZ', value)} />
                  <NumberInput label="Feedrate" value={settings.feedrate} onChange={(value) => handleSettingChange('feedrate', value)} />
                  <NumberInput label="Travel" value={settings.travelSpeed} onChange={(value) => handleSettingChange('travelSpeed', value)} />
                  <NumberInput label="Origin X" value={settings.originX} onChange={(value) => handleSettingChange('originX', value)} />
                  <NumberInput label="Origin Y" value={settings.originY} onChange={(value) => handleSettingChange('originY', value)} />
                  <NumberInput label="Tip off X" step="0.1" value={settings.penTipOffsetX} onChange={(value) => handleSettingChange('penTipOffsetX', value)} />
                  <NumberInput label="Tip off Y" step="0.1" value={settings.penTipOffsetY} onChange={(value) => handleSettingChange('penTipOffsetY', value)} />
                  <NumberInput label="Fine off X" step="0.1" value={settings.penOffsetX} onChange={(value) => handleSettingChange('penOffsetX', value)} />
                  <NumberInput label="Fine off Y" step="0.1" value={settings.penOffsetY} onChange={(value) => handleSettingChange('penOffsetY', value)} />
                  <NumberInput label="Park X" value={settings.parkX} onChange={(value) => handleSettingChange('parkX', value)} />
                  <NumberInput label="Park Y" value={settings.parkY} onChange={(value) => handleSettingChange('parkY', value)} />
                </div>
                <label className="toggle-row"><input type="checkbox" checked={settings.homeBeforePlot} onChange={(event) => handleSettingChange('homeBeforePlot', event.target.checked)} /><span>Home before plot</span></label>
                <label className="toggle-row"><input type="checkbox" checked={settings.mirrorOutputX} onChange={(event) => handleSettingChange('mirrorOutputX', event.target.checked)} /><span>Fix left-right flip</span></label>
                <label className="toggle-row"><input type="checkbox" checked={settings.mirrorOutputY} onChange={(event) => handleSettingChange('mirrorOutputY', event.target.checked)} /><span>Fix top-bottom flip</span></label>
                <label className="toggle-row"><input type="checkbox" checked={bambuSafetyHeader} onChange={(event) => setBambuSafetyHeader(event.target.checked)} /><span>Bambu safety header</span></label>
                <label className="toggle-row"><input type="checkbox" checked={lineNumbersEnabled} onChange={(event) => setLineNumbersEnabled(event.target.checked)} /><span>Line-number G-code</span></label>
              </div>
            )}
          </div>}

          <div className="control-group">
            <h2>Layers</h2>
            {layers.length === 0 && <p className="muted">Add the current design as a layer to compose multi-pen plots.</p>}
            {[...layers].sort((a, b) => a.order - b.order).map((layer) => (
              <div className="layer-row" key={layer.id}>
                <input type="checkbox" checked={layer.enabled} onChange={(event) => updateLayer(layer.id, { enabled: event.target.checked })} />
                <input type="color" value={layer.color} onChange={(event) => updateLayer(layer.id, { color: event.target.value })} />
                <span>{layer.name}</span>
                <button onClick={() => moveLayer(layer.id, -1)}>Up</button>
                <button onClick={() => moveLayer(layer.id, 1)}>Down</button>
                <button onClick={() => setLayers((current) => current.filter((item) => item.id !== layer.id))}>Remove</button>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

function NumberInput({ label, value, onChange, step = 1 }) {
  return <label><span>{label}</span><input type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

export default App;
