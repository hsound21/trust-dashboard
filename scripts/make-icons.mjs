// 앱 아이콘(PNG)을 외부 의존성 없이 생성합니다: node scripts/make-icons.mjs
// 디자인: 파란 배경 + 지붕(신탁·부동산) + 우상향 막대(재무 지표)
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../icons');
const ROOF = [[96, 210], [256, 90], [416, 210], [416, 258], [256, 138], [96, 258]];
const BARS = [[136, 330, 196, 420], [226, 280, 286, 420], [316, 230, 376, 420]];

const inPoly = (x, y, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const inRound = (x, y, r, size) => {
  const cx = Math.min(Math.max(x, r), size - r);
  const cy = Math.min(Math.max(y, r), size - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

// 한 픽셀(0~512 좌표계)의 색을 계산. 불투명 배경이 없으면 alpha 0
function shade(x, y, { rounded, scale }) {
  if (rounded && !inRound(x, y, 112, 512)) return [0, 0, 0, 0];
  // 로고 좌표계로 변환 (중심 기준 축소)
  const lx = (x - 256) / scale + 256;
  const ly = (y - 256) / scale + 256 - 10;
  const t = (x + y) / 1024;
  const bg = [59 + (30 - 59) * t, 130 + (58 - 130) * t, 246 + (138 - 246) * t];
  const hit = inPoly(lx, ly, ROOF) || BARS.some(([x0, y0, x1, y1]) => lx >= x0 && lx <= x1 && ly >= y0 && ly <= y1);
  return hit ? [255, 255, 255, 255] : [...bg, 255];
}

function render(size, opts) {
  const SS = 3;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py += 1) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px += 1) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const c = shade(((px + (sx + 0.5) / SS) * 512) / size, ((py + (sy + 0.5) / SS) * 512) / size, opts);
          const a = c[3] / 255;
          acc[0] += c[0] * a; acc[1] += c[1] * a; acc[2] += c[2] * a; acc[3] += a;
        }
      }
      const n = SS * SS;
      const o = py * (size * 4 + 1) + 1 + px * 4;
      const a = acc[3];
      raw[o] = a ? Math.round(acc[0] / a) : 0;
      raw[o + 1] = a ? Math.round(acc[1] / a) : 0;
      raw[o + 2] = a ? Math.round(acc[2] / a) : 0;
      raw[o + 3] = Math.round((a / n) * 255);
    }
  }
  return png(size, raw);
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function png(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <g fill="#fff" transform="translate(0,-10)">
    <polygon points="${ROOF.map((p) => p.join(',')).join(' ')}"/>
    ${BARS.map(([x0, y0, x1, y1]) => `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"/>`).join('\n    ')}
  </g>
</svg>
`;

const full = { rounded: false, scale: 1 };
await writeFile(resolve(DIR, 'icon.svg'), svg);
await writeFile(resolve(DIR, 'icon-192.png'), render(192, { rounded: true, scale: 1 }));
await writeFile(resolve(DIR, 'icon-512.png'), render(512, { rounded: true, scale: 1 }));
await writeFile(resolve(DIR, 'icon-maskable-512.png'), render(512, { ...full, scale: 0.72 })); // 안전영역(중앙 80%) 안에 배치
await writeFile(resolve(DIR, 'apple-touch-icon.png'), render(180, full)); // iOS가 모서리를 직접 둥글게 처리
console.log('아이콘 생성 완료:', DIR);
