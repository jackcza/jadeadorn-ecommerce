// Generates PWA icons (PNG) without external dependencies: jade background, gold bead ring.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const JADE = [53, 77, 64];
const GOLD = [185, 154, 99];
const CREAM = [246, 240, 228];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// scale: fraction of the icon used by the artwork (maskable icons keep art inside the safe zone)
function shade(nx, ny, { rounded, scale }) {
  if (rounded) {
    const r = 0.22;
    const dx = Math.max(Math.abs(nx - 0.5) - (0.5 - r), 0);
    const dy = Math.max(Math.abs(ny - 0.5) - (0.5 - r), 0);
    if (dx * dx + dy * dy > r * r) return null;
  }
  const x = (nx - 0.5) / scale;
  const y = (ny - 0.5) / scale;
  const beads = 14;
  const ringR = 0.3;
  for (let i = 0; i < beads; i++) {
    const a = (i / beads) * Math.PI * 2 - Math.PI / 2;
    const bx = ringR * Math.cos(a);
    const by = ringR * Math.sin(a);
    const d = Math.hypot(x - bx, y - by);
    if (d < 0.058) return d < 0.022 && i % 2 === 0 ? CREAM : GOLD;
  }
  // Diamond-shaped "gem" in the center
  if (Math.abs(x) / 0.1 + Math.abs(y + 0.01) / 0.14 <= 1) return Math.abs(x) < 0.012 ? GOLD : CREAM;
  return JADE;
}

function render(size, opts) {
  const ss = 4;
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = shade((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size, opts);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 255; }
        }
      }
      const n = ss * ss;
      const i = (py * size + px) * 4;
      const cover = a / 255;
      buf[i] = cover ? Math.round(r / cover) : 0;
      buf[i + 1] = cover ? Math.round(g / cover) : 0;
      buf[i + 2] = cover ? Math.round(b / cover) : 0;
      buf[i + 3] = Math.round(a / n);
    }
  }
  return encodePng(size, buf);
}

mkdirSync("public/icons", { recursive: true });
const outputs = [
  ["public/icons/icon-192.png", 192, { rounded: false, scale: 1 }],
  ["public/icons/icon-512.png", 512, { rounded: false, scale: 1 }],
  ["public/icons/maskable-512.png", 512, { rounded: false, scale: 0.72 }],
  ["public/icons/apple-touch-icon.png", 180, { rounded: false, scale: 0.9 }],
  ["public/icons/favicon-32.png", 32, { rounded: true, scale: 1 }],
];
for (const [file, size, opts] of outputs) {
  writeFileSync(file, render(size, opts));
  console.log(`Wrote ${file}`);
}
