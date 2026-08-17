'use strict';

// Generate DeepSeek Harness desktop icons as PNGs with zero dependencies.
// Draws a rounded-square 'D' mark (DeepSeek blue) into build/icons/ and assets/.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.max(x0 + r, Math.min(x, x1 - r));
  const cy = Math.max(y0 + r, Math.min(y, y1 - r));
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function inStem(x, y) {
  return inRoundedRect(x, y, 0.30, 0.28, 0.44, 0.72, 0.07);
}

function inBowl(x, y) {
  const cx = 0.52, cy = 0.50, rOuter = 0.235, rInner = 0.125;
  const d = Math.hypot(x - cx, y - cy);
  return d <= rOuter && d >= rInner;
}

function inMark(x, y) {
  return inStem(x, y) || inBowl(x, y);
}

const BG = [0x4d, 0x6b, 0xfe, 255];
const FG = [0xff, 0xff, 0xff, 255];

function render(size) {
  const ss = 4;
  const buf = Buffer.alloc(size * size * 4);
  const margin = size * 0.04;
  const radius = size * 0.205;
  const m = margin / size, r = radius / size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let rr = 0, gg = 0, bb = 0, aa = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const ux = (px + (sx + 0.5) / ss) / size;
          const uy = (py + (sy + 0.5) / ss) / size;
          if (!inRoundedRect(ux, uy, m, m, 1 - m, 1 - m, r)) continue;
          const col = inMark(ux, uy) ? FG : BG;
          rr += col[0]; gg += col[1]; bb += col[2]; aa += col[3];
        }
      }
      const n = ss * ss;
      const i = (py * size + px) * 4;
      buf[i] = Math.round(rr / n);
      buf[i + 1] = Math.round(gg / n);
      buf[i + 2] = Math.round(bb / n);
      buf[i + 3] = Math.round(aa / n);
    }
  }
  return encodePng(size, size, buf);
}

function main() {
  const iconsDir = path.join(ROOT, 'build', 'icons');
  const assetsDir = path.join(ROOT, 'assets');
  fs.mkdirSync(iconsDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });
  [16, 24, 32, 48, 64, 128, 256, 512, 1024].forEach((size) => {
    const png = render(size);
    fs.writeFileSync(path.join(iconsDir, size + 'x' + size + '.png'), png);
    console.log('wrote build/icons/' + size + 'x' + size + '.png (' + png.length + ' bytes)');
  });
  fs.writeFileSync(path.join(assetsDir, 'icon.png'), render(512));
  console.log('wrote assets/icon.png');
  fs.writeFileSync(path.join(assetsDir, 'tray.png'), render(32));
  console.log('wrote assets/tray.png');
  fs.writeFileSync(path.join(assetsDir, 'tray@2x.png'), render(64));
  console.log('wrote assets/tray@2x.png');
}

main();
