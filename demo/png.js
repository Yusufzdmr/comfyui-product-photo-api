import { deflateSync } from 'node:zlib';

/**
 * Bagimliliksiz minimal PNG encoder + basit cizim yardimcilari.
 * Demo'da ornek "oncesi/sonrasi" gorselleri uretmek icin kullanilir.
 * (Uretim pipeline'i ile ilgisi yoktur; sadece gorsel demo amaclidir.)
 */

// CRC32 tablosu (PNG chunk dogrulamasi icin)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/** Basit RGB tuval. */
export function createCanvas(width, height, bg = [255, 255, 255]) {
  const data = Buffer.alloc(width * height * 3);
  const canvas = { width, height, data };
  fillRect(canvas, 0, 0, width, height, bg);
  return canvas;
}

export function setPixel(c, x, y, [r, g, b]) {
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  const i = (y * c.width + x) * 3;
  c.data[i] = r;
  c.data[i + 1] = g;
  c.data[i + 2] = b;
}

export function fillRect(c, x, y, w, h, rgb) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(c.width, Math.floor(x + w));
  const y1 = Math.min(c.height, Math.floor(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) setPixel(c, xx, yy, rgb);
  }
}

/** Tuvali gecerli bir PNG Buffer'ina cevirir (renk tipi 2 = RGB). */
export function toPNG(c) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.width, 0);
  ihdr.writeUInt32BE(c.height, 4);
  ihdr[8] = 8; // bit derinligi
  ihdr[9] = 2; // renk tipi: RGB
  ihdr[10] = 0; // sikistirma
  ihdr[11] = 0; // filtre
  ihdr[12] = 0; // interlace yok

  // Her satir basina 1 filtre baytı (0 = None)
  const raw = Buffer.alloc(c.height * (c.width * 3 + 1));
  for (let y = 0; y < c.height; y++) {
    const rowStart = y * (c.width * 3 + 1);
    raw[rowStart] = 0;
    c.data.copy(raw, rowStart + 1, y * c.width * 3, (y + 1) * c.width * 3);
  }

  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Stilize bir "kozmetik sise" urunu cizer (demo urunu).
 * @param {object} c       tuval
 * @param {number} cx      merkez X
 * @param {number} cy      taban Y (urunun oturdugu zemin)
 * @param {number} scale   olcek (1 = ~temel boyut)
 */
export function drawProduct(c, cx, cy, scale = 1) {
  const w = Math.round(120 * scale); // govde genisligi
  const h = Math.round(200 * scale); // govde yuksekligi
  const capW = Math.round(60 * scale);
  const capH = Math.round(50 * scale);

  const bodyX = cx - w / 2;
  const bodyY = cy - h;

  // Yumusak golge (zemin)
  fillRect(c, bodyX - 10 * scale, cy - 8 * scale, w + 20 * scale, 14 * scale, [210, 210, 210]);

  // Sise govdesi
  fillRect(c, bodyX, bodyY, w, h, [46, 139, 139]);
  // Sol kenar parlama
  fillRect(c, bodyX + 8 * scale, bodyY + 10 * scale, 14 * scale, h - 30 * scale, [120, 200, 200]);
  // Etiket
  fillRect(c, bodyX + 18 * scale, bodyY + h / 2 - 22 * scale, w - 36 * scale, 44 * scale, [245, 245, 245]);
  fillRect(c, bodyX + 30 * scale, bodyY + h / 2 - 6 * scale, w - 60 * scale, 6 * scale, [46, 139, 139]);

  // Kapak
  fillRect(c, cx - capW / 2, bodyY - capH, capW, capH, [34, 34, 34]);
}
