import { app, BrowserWindow } from 'electron';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const buildDir = path.join(rootDir, 'build');

mkdirSync(buildDir, { recursive: true });

const svgContent = readFileSync(path.join(rootDir, 'public', 'favicon.svg'), 'utf-8');
const svgFullSize = svgContent.replace(
  '<svg ',
  '<svg width="1024" height="1024" ',
);

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    backgroundColor: '#67e8f9',
    webPreferences: {
      offscreen: true,
      sandbox: false,
    },
  });

  const html = `<!DOCTYPE html>
<html><head><style>body{margin:0;width:1024px;height:1024px;background:#67e8f9;display:flex;align-items:center;justify-content:center}</style></head>
<body>${svgFullSize}</body></html>`;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // Wait for render
  await new Promise(resolve => setTimeout(resolve, 1500));

  const image = await win.webContents.capturePage();

  const sizes = [
    { name: 'icon.png', size: 1024 },
    { name: 'icon-512.png', size: 512 },
    { name: 'icon-256.png', size: 256 },
  ];

  for (const { name, size } of sizes) {
    const resized = size === 1024 ? image : image.resize({ width: size, height: size });
    const png = resized.toPNG();
    writeFileSync(path.join(buildDir, name), png);
    console.log(`Generated ${name} (${png.length} bytes)`);
  }

  win.destroy();
  app.quit();
  console.log('Icon generation complete.');
});
