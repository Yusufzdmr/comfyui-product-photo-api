import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { ComfyUIClient } from './comfyClient.js';
import { buildProductPhotoWorkflow } from './workflows/productPhoto.js';
import { config } from './config.js';
import { logger } from './logger.js';

/**
 * Urun gorseli isleme pipeline'i.
 * ComfyUIClient'i kullanarak tek bir gorseli ucdan uca isler:
 *   yerel dosya -> upload -> workflow calistir -> sonucu indir -> diske kaydet
 */
export class ProductImagePipeline {
  constructor(client = null) {
    this.client =
      client ||
      new ComfyUIClient({
        baseUrl: config.comfy.baseUrl,
        wsUrl: config.comfy.wsUrl,
        timeoutMs: config.pipeline.jobTimeoutMs,
      });
  }

  /**
   * Tek bir urun gorselini isler.
   * @param {string} inputPath  yerel gorsel yolu
   * @param {object} [opts]
   * @param {string} [opts.bgColor]
   * @param {boolean} [opts.upscale]
   * @returns {Promise<string[]>} kaydedilen cikti dosyalarinin yollari
   */
  async processFile(inputPath, opts = {}) {
    const name = basename(inputPath);
    const stem = basename(inputPath, extname(inputPath));
    logger.info(`Isleniyor: ${name}`);

    // 1) Gorseli oku ve ComfyUI'a yukle
    const buffer = await readFile(inputPath);
    const uploaded = await this.client.uploadImage(buffer, name);

    // 2) Workflow'u kur
    const workflow = buildProductPhotoWorkflow({
      imageName: uploaded.name,
      upscaleModel: config.pipeline.upscaleModel,
      bgColor: opts.bgColor || config.pipeline.studioBgColor,
      upscale: opts.upscale !== false,
      filenamePrefix: `${stem}_studio`,
    });

    // 3) Calistir + canli ilerleme
    const images = await this.client.runWorkflow(workflow, ({ value, max }) => {
      if (max) process.stdout.write(`\r   ilerleme: ${value}/${max}   `);
    });
    process.stdout.write('\n');

    if (!images.length) {
      throw new Error('Workflow cikti uretmedi (SaveImage node kontrol et).');
    }

    // 4) Sonuclari indir ve kaydet
    await mkdir(config.paths.outputDir, { recursive: true });
    const saved = [];
    for (const img of images) {
      const data = await this.client.fetchImage(img);
      const outPath = join(config.paths.outputDir, img.filename);
      await writeFile(outPath, data);
      saved.push(outPath);
      logger.success(`Kaydedildi: ${outPath} (${(data.length / 1024).toFixed(0)} KB)`);
    }
    return saved;
  }

  /**
   * Bir klasordeki tum gorselleri sirayla isler.
   * @param {string[]} files yerel gorsel yollari
   * @param {object} [opts]
   * @returns {Promise<{ok:string[], failed:Array<{file:string,error:string}>}>}
   */
  async processBatch(files, opts = {}) {
    const ok = [];
    const failed = [];
    for (const f of files) {
      try {
        const saved = await this.processFile(f, opts);
        ok.push(...saved);
      } catch (err) {
        logger.error(`Basarisiz: ${f} -> ${err.message}`);
        failed.push({ file: f, error: err.message });
      }
    }
    return { ok, failed };
  }
}

export default ProductImagePipeline;
