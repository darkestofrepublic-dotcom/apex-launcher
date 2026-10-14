// Génère les icônes du projet (pur Node, sans dépendance) :
// - assets/icon.ico (BMP multi-tailles, compatible rcedit/Inno)
// - assets/icon.icns (macOS : PNG 32/64/128/256/512)
// - assets/icons/<n>x<n>.png + icon.png (Linux)
// - assets/icon.svg est la source maîtresse (dessinée à la main) : ne pas l'écraser.
// Motif : pic/sommet APEX + diamant, tuile sombre.
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "assets");
mkdirSync(assets, { recursive: true });
mkdirSync(join(assets, "icons"), { recursive: true });

// Sommet en coordonnées 256 (même géométrie que icon.svg).
const PEAK = [[46, 192], [128, 60], [210, 192], [174, 192], [128, 114], [82, 192]];
const DIAMOND = { cx: 128, cy: 40, r: 14 };

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Dessine le logo en RGBA (haut vers bas) pour une taille donnée. */
function draw(size) {
  const k = size / 256;
  const px = Buffer.alloc(size * size * 4);
  const peak = PEAK.map(([x, y]) => [x * k, y * k]);
  const dcx = DIAMOND.cx * k;
  const dcy = DIAMOND.cy * k;
  const dr = DIAMOND.r * k;
  const inset = 8 * k;
  const radius = 58 * k;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      // Tuile arrondie
      const dx = Math.min(x - inset, size - 1 - x - inset);
      const dy = Math.min(y - inset, size - 1 - y - inset);
      const corner = dx < radius && dy < radius && Math.hypot(radius - dx, radius - dy) > radius;
      const outside = x < inset || y < inset || x >= size - inset || y >= size - inset || corner;
      if (outside) {
        px[o + 3] = 0;
        continue;
      }
      const inPeak = pointInPoly(x + 0.5, y + 0.5, peak);
      const inDiamond = Math.abs(x + 0.5 - dcx) / dr + Math.abs(y + 0.5 - dcy) / dr <= 1;
      if (inDiamond) {
        px[o] = 103; px[o + 1] = 232; px[o + 2] = 249; px[o + 3] = 255;
      } else if (inPeak) {
        const t = y / (size - 1);
        px[o] = Math.round(255 - t * (255 - 188));
        px[o + 1] = Math.round(255 - t * (255 - 210));
        px[o + 2] = 255;
        px[o + 3] = 255;
      } else {
        // Tuile sombre : dégradé vertical #1b2133 -> #0d1120 + halo discret.
        const t = y / (size - 1);
        px[o] = Math.round(27 - t * (27 - 13));
        px[o + 1] = Math.round(33 - t * (33 - 17));
        px[o + 2] = Math.round(51 - t * (51 - 32));
        px[o + 3] = 255;
      }
    }
  }
  return px;
}

// ---------- ICO (BMP 32 bits) ----------

function toBmpEntry(px, size) {
  const rowStride = size * 4;
  const xor = Buffer.alloc(rowStride * size);
  for (let y = 0; y < size; y++) {
    px.copy(xor, (size - 1 - y) * rowStride, y * rowStride, (y + 1) * rowStride);
    for (let x = 0; x < size; x++) {
      const o = (size - 1 - y) * rowStride + x * 4;
      const r = xor[o];
      xor[o] = xor[o + 2];
      xor[o + 2] = r;
    }
  }
  const maskRow = Math.ceil(size / 32) * 4;
  const and = Buffer.alloc(maskRow * size, 0);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (px[(y * size + x) * 4 + 3] < 128) {
        and[(size - 1 - y) * maskRow + Math.floor(x / 8)] |= 0x80 >> (x % 8);
      }
    }
  }
  const info = Buffer.alloc(40);
  info.writeUInt32LE(40, 0);
  info.writeInt32LE(size, 4);
  info.writeInt32LE(size * 2, 8);
  info.writeUInt16LE(1, 12);
  info.writeUInt16LE(32, 14);
  return Buffer.concat([info, xor, and]);
}

const icoSizes = [16, 32, 48, 256];
const entries = icoSizes.map((s) => toBmpEntry(draw(s), s));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(entries.length, 4);
const dir = Buffer.alloc(16 * entries.length);
let offset = 6 + dir.length;
entries.forEach((img, i) => {
  const s = icoSizes[i];
  const o = i * 16;
  dir[o] = s >= 256 ? 0 : s;
  dir[o + 1] = s >= 256 ? 0 : s;
  dir[o + 2] = 0;
  dir[o + 3] = 0;
  dir.writeUInt16LE(1, o + 4);
  dir.writeUInt16LE(32, o + 6);
  dir.writeUInt32LE(img.length, o + 8);
  dir.writeUInt32LE(offset, o + 12);
  offset += img.length;
});
writeFileSync(join(assets, "icon.ico"), Buffer.concat([header, dir, ...entries]));
console.log("icon.ico OK (" + icoSizes.join("/") + "px BMP)");

// ---------- PNG (pur Node) ----------

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng(px, size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- ICNS (macOS) ----------

const icnsSizes = [
  ["ic11", 32],
  ["ic12", 64],
  ["ic07", 128],
  ["ic08", 256],
  ["ic09", 512],
];
const icnsParts = [];
let icnsLen = 8;
for (const [type, size] of icnsSizes) {
  const png = encodePng(draw(size), size);
  const head = Buffer.alloc(8);
  head.write(type, 0, "ascii");
  head.writeUInt32BE(8 + png.length, 4);
  icnsParts.push(head, png);
  icnsLen += 8 + png.length;
}
const icnsHead = Buffer.alloc(8);
icnsHead.write("icns", 0, "ascii");
icnsHead.writeUInt32BE(icnsLen, 4);
writeFileSync(join(assets, "icon.icns"), Buffer.concat([icnsHead, ...icnsParts]));
console.log("icon.icns OK (32/64/128/256/512)");

// ---------- PNG Linux ----------

for (const size of [16, 32, 48, 64, 128, 256, 512]) {
  writeFileSync(join(assets, "icons", `${size}x${size}.png`), encodePng(draw(size), size));
}
writeFileSync(join(assets, "icon.png"), encodePng(draw(512), 512));
console.log("icons/*.png OK (Linux)");
