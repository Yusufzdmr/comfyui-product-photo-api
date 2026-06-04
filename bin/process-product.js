#!/usr/bin/env node
/**
 * Tek bir urun gorselini isler.
 *
 * Kullanim:
 *   node bin/process-product.js ./input/ayakkabi.jpg
 *   node bin/process-product.js ./input/ayakkabi.jpg --bg=F5F5F5 --no-upscale
 */
import { ProductImagePipeline } from '../src/pipeline.js';
import { logger } from '../src/logger.js';

function parseArgs(argv) {
  const opts = {};
  const positional = [];
  for (const a of argv) {
    if (a === '--no-upscale') opts.upscale = false;
    else if (a.startsWith('--bg=')) opts.bgColor = a.slice('--bg='.length);
    else positional.push(a);
  }
  return { input: positional[0], opts };
}

async function main() {
  const { input, opts } = parseArgs(process.argv.slice(2));
  if (!input) {
    logger.error('Kullanim: node bin/process-product.js <gorsel-yolu> [--bg=HEX] [--no-upscale]');
    process.exit(1);
  }

  const pipeline = new ProductImagePipeline();
  try {
    await pipeline.client.ping();
  } catch (err) {
    logger.error(`ComfyUI sunucusuna baglanilamadi: ${err.message}`);
    logger.warn('ComfyUI calisiyor mu? .env icindeki COMFYUI_HOST/PORT dogru mu?');
    process.exit(1);
  }

  const start = Date.now();
  const saved = await pipeline.processFile(input, opts);
  logger.success(`Tamamlandi: ${saved.length} dosya, ${((Date.now() - start) / 1000).toFixed(1)} sn`);
}

main().catch((err) => {
  logger.error(err.message);
  process.exit(1);
});
