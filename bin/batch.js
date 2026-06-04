#!/usr/bin/env node
/**
 * Bir klasordeki tum urun gorsellerini toplu isler.
 *
 * Kullanim:
 *   node bin/batch.js                 # .env -> INPUT_DIR icindeki tum gorseller
 *   node bin/batch.js ./urunler --bg=F5F5F5
 */
import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { ProductImagePipeline } from '../src/pipeline.js';
import { config } from '../src/config.js';
import { logger } from '../src/logger.js';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function parseArgs(argv) {
  const opts = {};
  let dir = null;
  for (const a of argv) {
    if (a === '--no-upscale') opts.upscale = false;
    else if (a.startsWith('--bg=')) opts.bgColor = a.slice('--bg='.length);
    else dir = a;
  }
  return { dir: dir || config.paths.inputDir, opts };
}

async function main() {
  const { dir, opts } = parseArgs(process.argv.slice(2));

  const entries = await readdir(dir).catch(() => {
    logger.error(`Klasor okunamadi: ${dir}`);
    process.exit(1);
  });
  const files = entries
    .filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()))
    .map((f) => join(dir, f));

  if (!files.length) {
    logger.warn(`${dir} icinde islenecek gorsel bulunamadi.`);
    process.exit(0);
  }

  logger.info(`${files.length} gorsel bulundu: ${dir}`);
  const pipeline = new ProductImagePipeline();

  try {
    await pipeline.client.ping();
  } catch (err) {
    logger.error(`ComfyUI sunucusuna baglanilamadi: ${err.message}`);
    process.exit(1);
  }

  const start = Date.now();
  const { ok, failed } = await pipeline.processBatch(files, opts);

  logger.info('--------------------------------------------------');
  logger.success(`Basarili cikti: ${ok.length} dosya`);
  if (failed.length) logger.error(`Basarisiz: ${failed.length} gorsel`);
  logger.info(`Toplam sure: ${((Date.now() - start) / 1000).toFixed(1)} sn`);
}

main().catch((err) => {
  logger.error(err.message);
  process.exit(1);
});
