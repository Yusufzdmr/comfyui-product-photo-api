#!/usr/bin/env node
/**
 * OFFLINE DEMO
 * ------------
 * ComfyUI / GPU GEREKTIRMEZ. Su adimlari yapar:
 *   1. Ornek bir "ham urun fotografi" uretir            -> input/demo-product.png
 *   2. Mock ComfyUI sunucusunu baslatir
 *   3. GERCEK pipeline'i mock sunucuya karsi calistirir  (upload -> prompt -> ws -> view)
 *   4. Islenmis "studyo" gorselini kaydeder             -> output/demo-product_studio_00001_.png
 *
 * Boylece orchestration kodunun (src/) gercekten ucdan uca calistigi gorulur.
 *
 * Calistir:  npm run demo
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { startMockServer } from './mock-comfy-server.js';
import { generateInputImage } from './assets.js';
import { ComfyUIClient } from '../src/comfyClient.js';
import { ProductImagePipeline } from '../src/pipeline.js';
import { logger } from '../src/logger.js';

async function main() {
  logger.info('=== OFFLINE DEMO (ComfyUI gerektirmez) ===');

  // 1) Ornek girdi gorseli
  await mkdir('input', { recursive: true });
  const inputPath = 'input/demo-product.png';
  await writeFile(inputPath, generateInputImage());
  logger.success(`Ornek ham urun gorseli olusturuldu: ${inputPath}`);

  // 2) Mock ComfyUI
  const mock = await startMockServer(8199);
  logger.success(`Mock ComfyUI ayakta: ${mock.baseUrl}`);

  // 3) Gercek pipeline'i mock'a yonlendir
  const client = new ComfyUIClient({ baseUrl: mock.baseUrl, wsUrl: mock.wsUrl, timeoutMs: 30000 });
  const pipeline = new ProductImagePipeline(client);

  try {
    const saved = await pipeline.processFile(inputPath, { bgColor: 'FFFFFF', upscale: true });
    logger.success('Demo tamamlandi. Karsilastir:');
    logger.info(`  ONCESI : ${inputPath}`);
    for (const s of saved) logger.info(`  SONRASI: ${s}`);
  } finally {
    await mock.close();
  }
}

main().catch((err) => {
  logger.error(err.message);
  process.exit(1);
});
